import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Soup from "gi://Soup";

Gio._promisify(Gio.Subprocess.prototype, "wait_async", "wait_finish");
Gio._promisify(
  Gio.DataInputStream.prototype,
  "read_line_async",
  "read_line_finish_utf8",
);
Gio._promisify(
  Soup.Session.prototype,
  "send_and_read_async",
  "send_and_read_finish",
);

// Loading a multi-GB model from a slow disk can take a while.
const STARTUP_TIMEOUT_MS = 180_000;
const HEALTH_POLL_MS = 500;
const LOG_TAIL_LINES = 20;

// Subtitle cues are short, so a small context keeps memory use low.
const CONTEXT_SIZE = 4096;

export class EngineError extends Error {}

function findServerBinary(): string | null {
  return (
    GLib.getenv("PIPOCA_LLAMA_SERVER") ??
    GLib.find_program_in_path("llama-server")
  );
}

function findFreePort(): number {
  const socket = Gio.Socket.new(
    Gio.SocketFamily.IPV4,
    Gio.SocketType.STREAM,
    Gio.SocketProtocol.TCP,
  );
  socket.bind(Gio.InetSocketAddress.new_from_string("127.0.0.1", 0), false);
  const port = (socket.get_local_address() as Gio.InetSocketAddress).get_port();
  socket.close();
  return port;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

type ServerProcess = {
  process: Gio.Subprocess;
  port: number;
  exited: boolean;
  logTail: string[];
};

/**
 * Runs a private llama-server instance bound to localhost and talks to its
 * OpenAI-compatible API. Only one model is loaded at a time.
 */
export class LlamaServer {
  private readonly _session = new Soup.Session({timeout: 0});
  private _current: ServerProcess | null = null;
  private _modelPath: string | null = null;
  private _ready: Promise<void> | null = null;

  /** Starts the server for `modelPath`, reusing it if that model is already loaded. */
  public ensureRunning(modelPath: string): Promise<void> {
    if (
      this._ready &&
      this._modelPath === modelPath &&
      this._current &&
      !this._current.exited
    ) {
      return this._ready;
    }

    this.stop();
    this._modelPath = modelPath;
    const ready = this._start(modelPath).catch((e: unknown) => {
      if (this._ready === ready) {
        this._ready = null;
        this._modelPath = null;
      }
      throw e;
    });
    this._ready = ready;
    return ready;
  }

  public stop(): void {
    const current = this._current;
    this._current = null;
    this._ready = null;
    this._modelPath = null;
    if (current && !current.exited) {
      current.process.send_signal(15); // SIGTERM
    }
  }

  public async chat(
    body: object,
    cancellable: Gio.Cancellable | null = null,
  ): Promise<string> {
    const current = this._current;
    if (!current || current.exited) {
      throw new EngineError("The translation engine is not running");
    }

    const message = Soup.Message.new(
      "POST",
      `http://127.0.0.1:${current.port}/v1/chat/completions`,
    );
    const payload = new TextEncoder().encode(JSON.stringify(body));
    message.set_request_body_from_bytes(
      "application/json",
      GLib.Bytes.new(payload),
    );

    const bytes: GLib.Bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      cancellable,
    );
    const text = new TextDecoder().decode(bytes.get_data() ?? new Uint8Array());

    if (message.get_status() !== 200) {
      throw new EngineError(
        `Translation engine error (HTTP ${message.get_status()}): ${text}`,
      );
    }

    const content = JSON.parse(text)?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new EngineError("Unexpected response from translation engine");
    }
    return content;
  }

  private async _start(modelPath: string): Promise<void> {
    const binary = findServerBinary();
    if (!binary) {
      throw new EngineError("llama-server was not found");
    }

    // Let llama.cpp pick the GPU (Vulkan) and fit layers automatically. If that
    // crashes, e.g. on a broken driver, fall back to running on the CPU only.
    try {
      await this._spawn(binary, modelPath, []);
    } catch (e) {
      if (!(e instanceof EngineError) || this._modelPath !== modelPath) throw e;
      console.warn(
        `llama-server failed to start with GPU offload, retrying on CPU: ${e.message}`,
      );
      await this._spawn(binary, modelPath, ["--device", "none"]);
    }
  }

  private async _spawn(
    binary: string,
    modelPath: string,
    extraArgs: string[],
  ): Promise<void> {
    const port = findFreePort();
    const argv = [
      binary,
      "--model",
      modelPath,
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--ctx-size",
      String(CONTEXT_SIZE),
      "--parallel",
      "1",
      "--reasoning",
      "off",
      "--no-webui",
      ...extraArgs,
    ];
    console.log(`Starting ${argv.join(" ")}`);

    const process = Gio.Subprocess.new(
      argv,
      Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE,
    );
    const server: ServerProcess = {process, port, exited: false, logTail: []};
    this._current = server;

    void this._pumpLog(server);
    process
      .wait_async(null)
      .then(() => {
        server.exited = true;
        if (this._current === server) {
          // Crashed or was killed after startup; the next request restarts it.
          this._ready = null;
          this._modelPath = null;
          console.warn(
            `llama-server exited with status ${process.get_exit_status()}`,
          );
        }
      })
      .catch(console.error);

    const deadline = GLib.get_monotonic_time() + STARTUP_TIMEOUT_MS * 1000;
    while (GLib.get_monotonic_time() < deadline) {
      if (this._current !== server) {
        throw new Error("Engine start was superseded");
      }
      if (server.exited) {
        throw new EngineError(
          server.logTail.slice(-3).join("\n") ||
            "llama-server exited during startup",
        );
      }
      if (await this._isHealthy(port)) {
        return;
      }
      await delay(HEALTH_POLL_MS);
    }

    process.force_exit();
    throw new EngineError("Timed out while loading the model");
  }

  private async _isHealthy(port: number): Promise<boolean> {
    try {
      const message = Soup.Message.new(
        "GET",
        `http://127.0.0.1:${port}/health`,
      );
      await this._session.send_and_read_async(
        message,
        GLib.PRIORITY_DEFAULT,
        null,
      );
      return message.get_status() === 200;
    } catch {
      return false;
    }
  }

  // Forwards server output to our log and keeps the last lines for error messages.
  private async _pumpLog(server: ServerProcess): Promise<void> {
    const stdout = server.process.get_stdout_pipe();
    if (!stdout) return;
    const stream = Gio.DataInputStream.new(stdout);
    try {
      for (;;) {
        const [line] = (await stream.read_line_async(
          GLib.PRIORITY_LOW,
          null,
        )) as unknown as [string | null, number];
        if (line === null) break;
        printerr(`[llama-server] ${line}`);
        server.logTail.push(line);
        if (server.logTail.length > LOG_TAIL_LINES) server.logTail.shift();
      }
    } catch (e) {
      console.warn("Stopped reading llama-server output:", e);
    }
  }
}

export const server = new LlamaServer();
