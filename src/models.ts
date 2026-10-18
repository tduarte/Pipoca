import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Soup from "gi://Soup";

Gio._promisify(Soup.Session.prototype, "send_async", "send_finish");
Gio._promisify(
  Gio.InputStream.prototype,
  "read_bytes_async",
  "read_bytes_finish",
);

/** How the model expects to be prompted; see translator.ts. */
export type PromptStyle = "index-translate" | "hy-mt";

export type CatalogModel = {
  id: string;
  name: string;
  description: string;
  url: string;
  sizeBytes: number;
  /** Total system memory (GB) below which we don't suggest this model. */
  minMemoryGB: number;
  promptStyle: PromptStyle;
  /** Offered in the list but never suggested automatically. */
  alternative?: boolean;
  /** Target language codes the model can't translate into. */
  unsupportedLanguages?: string[];
};

// Curated models offered during onboarding. Files are ungated GGUF
// quantizations on Hugging Face so they download anonymously.
export const catalog: CatalogModel[] = [
  {
    id: "index-translate-2b",
    name: "Index-Translate 2B",
    description: "Small and fast. Works on most computers.",
    url: "https://huggingface.co/IndexTeam/Index-Translate-2B-GGUF/resolve/main/Index-Translate-2B.Q4_K_M.gguf",
    sizeBytes: 1_312_164_352,
    minMemoryGB: 0,
    promptStyle: "index-translate",
  },
  {
    id: "index-translate-9b",
    name: "Index-Translate 9B",
    description: "Best translation quality, but slower.",
    url: "https://huggingface.co/IndexTeam/Index-Translate-9B-GGUF/resolve/main/Index-Translate-9B.Q4_K_M.gguf",
    sizeBytes: 5_780_090_304,
    minMemoryGB: 12,
    promptStyle: "index-translate",
  },
  {
    id: "hy-mt2-7b",
    name: "Hy-MT2 7B",
    description: "Proven alternative from Tencent. Does not support Greek.",
    url: "https://huggingface.co/tencent/Hy-MT2-7B-GGUF/resolve/main/Hy-MT2-7B-Q4_K_M.gguf",
    sizeBytes: 4_624_648_896,
    minMemoryGB: 12,
    promptStyle: "hy-mt",
    alternative: true,
    unsupportedLanguages: ["el"],
  },
];

const DOWNLOAD_CHUNK_SIZE = 1024 * 1024;

export function getModel(id: string): CatalogModel | undefined {
  return catalog.find(m => m.id === id);
}

export function modelsDir(): string {
  return GLib.build_filenamev([GLib.get_user_data_dir(), "models"]);
}

export function modelPath(model: CatalogModel): string {
  return GLib.build_filenamev([modelsDir(), GLib.path_get_basename(model.url)]);
}

export function isInstalled(model: CatalogModel): boolean {
  return GLib.file_test(modelPath(model), GLib.FileTest.EXISTS);
}

export function installedModels(): CatalogModel[] {
  return catalog.filter(isInstalled);
}

export function deleteModel(model: CatalogModel): void {
  for (const path of [modelPath(model), `${modelPath(model)}.part`]) {
    const file = Gio.File.new_for_path(path);
    if (file.query_exists(null)) file.delete(null);
  }
}

export function formatSize(bytes: number): string {
  return GLib.format_size(bytes);
}

/** Total system memory in GB, or 0 if it can't be determined. */
export function totalMemoryGB(): number {
  try {
    const [, contents] = GLib.file_get_contents("/proc/meminfo");
    const match = new TextDecoder()
      .decode(contents)
      .match(/^MemTotal:\s+(\d+)\s+kB/m);
    return match ? Number(match[1]) / (1024 * 1024) : 0;
  } catch {
    return 0;
  }
}

/** The largest primary catalog model this machine comfortably runs. */
export function suggestedModel(): CatalogModel {
  const memory = totalMemoryGB();
  const primary = catalog.filter(m => !m.alternative);
  // Without memory info, stay on the safe side and suggest the smallest one.
  const fitting = primary.filter(m => memory > 0 && m.minMemoryGB <= memory);
  return fitting[fitting.length - 1] ?? (primary[0] as CatalogModel);
}

export function supportsLanguage(model: CatalogModel, code: string): boolean {
  return !model.unsupportedLanguages?.includes(code);
}

function freeDiskSpace(dir: Gio.File): number | null {
  try {
    const info = dir.query_filesystem_info("filesystem::free", null);
    return info.has_attribute("filesystem::free")
      ? info.get_attribute_uint64("filesystem::free")
      : null;
  } catch {
    return null;
  }
}

/**
 * Downloads `model` into modelsDir(). Partial downloads are kept as `.part`
 * files and resumed on the next attempt.
 */
export async function downloadModel(
  model: CatalogModel,
  onProgress: (received: number, total: number) => void,
  cancellable: Gio.Cancellable,
): Promise<void> {
  const dir = Gio.File.new_for_path(modelsDir());
  if (!dir.query_exists(null)) dir.make_directory_with_parents(null);

  const target = Gio.File.new_for_path(modelPath(model));
  const part = Gio.File.new_for_path(`${modelPath(model)}.part`);

  let offset = part.query_exists(null)
    ? part
        .query_info("standard::size", Gio.FileQueryInfoFlags.NONE, null)
        .get_size()
    : 0;

  const free = freeDiskSpace(dir);
  if (free !== null && free < model.sizeBytes - offset) {
    throw new Error(
      `Not enough disk space: ${formatSize(model.sizeBytes - offset)} needed, ${formatSize(free)} available`,
    );
  }

  const session = new Soup.Session({timeout: 60});
  const message = Soup.Message.new("GET", model.url);
  if (offset > 0) {
    message.get_request_headers().append("Range", `bytes=${offset}-`);
  }

  const input: Gio.InputStream = await session.send_async(
    message,
    GLib.PRIORITY_DEFAULT,
    cancellable,
  );
  const status = message.get_status();

  let output: Gio.FileOutputStream;
  if (status === 206) {
    output = part.append_to(Gio.FileCreateFlags.NONE, null);
  } else if (status === 200) {
    offset = 0;
    output = part.replace(null, false, Gio.FileCreateFlags.NONE, null);
  } else {
    // A stale .part file can make the range request invalid (416); start over next time.
    if (status === 416) part.delete(null);
    throw new Error(`Download failed (HTTP ${status})`);
  }

  const contentLength = Number(
    message.get_response_headers().get_content_length(),
  );
  const total = contentLength > 0 ? offset + contentLength : model.sizeBytes;
  let received = offset;
  onProgress(received, total);

  try {
    for (;;) {
      const bytes = await input.read_bytes_async(
        DOWNLOAD_CHUNK_SIZE,
        GLib.PRIORITY_DEFAULT,
        cancellable,
      );
      const data = bytes.get_data();
      if (!data || data.length === 0) break;
      output.write_all(data, cancellable);
      received += data.length;
      onProgress(received, total);
    }
  } finally {
    output.close(null);
    input.close(null);
  }

  if (received < model.sizeBytes) {
    throw new Error(
      `Download interrupted at ${formatSize(received)} of ${formatSize(model.sizeBytes)}, try again to resume`,
    );
  }
  if (received > model.sizeBytes) {
    part.delete(null);
    throw new Error("Downloaded file does not match the expected size");
  }

  part.move(target, Gio.FileCopyFlags.OVERWRITE, null, null);
}
