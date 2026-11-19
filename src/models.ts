import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Soup from "gi://Soup";

import {_, fmt} from "./i18n";
import type {PromptStyle} from "./prompts";

Gio._promisify(Soup.Session.prototype, "send_async", "send_finish");
Gio._promisify(
  Gio.InputStream.prototype,
  "read_bytes_async",
  "read_bytes_finish",
);
Gio._promisify(Gio.File.prototype, "read_async", "read_finish");

// Marks a string for translation without translating it here.
const N_ = (text: string): string => text;

export type CatalogModel = {
  id: string;
  name: string;
  description: string;
  url: string;
  sizeBytes: number;
  /** SHA-256 of the file, as published by Hugging Face. */
  sha256: string;
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
    description: N_("Small and fast. Works on most computers."),
    url: "https://huggingface.co/IndexTeam/Index-Translate-2B-GGUF/resolve/main/Index-Translate-2B.Q4_K_M.gguf",
    sizeBytes: 1_312_164_352,
    sha256: "044b313d29342bd3b2c77cbb64023ca0d209bd9b3247763f9d162767ef2d746a",
    minMemoryGB: 0,
    promptStyle: "index-translate",
  },
  {
    id: "index-translate-9b",
    name: "Index-Translate 9B",
    description: N_("Best translation quality, but slower."),
    url: "https://huggingface.co/IndexTeam/Index-Translate-9B-GGUF/resolve/main/Index-Translate-9B.Q4_K_M.gguf",
    sizeBytes: 5_780_090_304,
    sha256: "9cc6758b0007f4cbf42ea3400768cbff91ae74ef8d640e467158348426d33713",
    minMemoryGB: 12,
    promptStyle: "index-translate",
  },
  {
    id: "hy-mt2-7b",
    name: "Hy-MT2 7B",
    description: N_("Proven alternative from Tencent. Does not support Greek."),
    url: "https://huggingface.co/tencent/Hy-MT2-7B-GGUF/resolve/main/Hy-MT2-7B-Q4_K_M.gguf",
    sizeBytes: 4_624_648_896,
    sha256: "9f96256500f3fc1ab4d64336b58f52a949a95ad7516b0c229476eef782f9f77b",
    minMemoryGB: 12,
    promptStyle: "hy-mt",
    alternative: true,
    unsupportedLanguages: ["el"],
  },
];

const DOWNLOAD_CHUNK_SIZE = 1024 * 1024;
const CHECKSUM_CHUNK_SIZE = 4 * 1024 * 1024;

export type DownloadPhase = "downloading" | "verifying";

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

async function sha256(
  file: Gio.File,
  size: number,
  onProgress: (done: number, total: number) => void,
  cancellable: Gio.Cancellable,
): Promise<string> {
  const checksum = GLib.Checksum.new(GLib.ChecksumType.SHA256);
  if (!checksum) throw new Error("SHA-256 is not available");

  const input = await file.read_async(GLib.PRIORITY_DEFAULT, cancellable);
  let done = 0;
  try {
    for (;;) {
      const bytes = await input.read_bytes_async(
        CHECKSUM_CHUNK_SIZE,
        GLib.PRIORITY_DEFAULT,
        cancellable,
      );
      const data = bytes.get_data();
      if (!data || data.length === 0) break;
      checksum.update(data);
      done += data.length;
      onProgress(done, size);
    }
  } finally {
    input.close(null);
  }
  return checksum.get_string();
}

/**
 * Downloads `model` into modelsDir() and checks it against its published
 * checksum. Partial downloads are kept as `.part` files and resumed on the
 * next attempt.
 */
export async function downloadModel(
  model: CatalogModel,
  onProgress: (phase: DownloadPhase, done: number, total: number) => void,
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
      fmt(
        _("Not enough disk space: %s needed, %s available"),
        formatSize(model.sizeBytes - offset),
        formatSize(free),
      ),
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
    throw new Error(fmt(_("Download failed (HTTP %s)"), status));
  }

  const contentLength = Number(
    message.get_response_headers().get_content_length(),
  );
  const total = contentLength > 0 ? offset + contentLength : model.sizeBytes;
  let received = offset;
  onProgress("downloading", received, total);

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
      onProgress("downloading", received, total);
    }
  } finally {
    output.close(null);
    input.close(null);
  }

  if (received < model.sizeBytes) {
    throw new Error(
      fmt(
        _("Download interrupted at %s of %s, try again to resume"),
        formatSize(received),
        formatSize(model.sizeBytes),
      ),
    );
  }

  // A resumed or tampered download can have the right size but the wrong
  // contents, so check it before it is ever loaded.
  const digest =
    received === model.sizeBytes
      ? await sha256(
          part,
          model.sizeBytes,
          (done, size) => onProgress("verifying", done, size),
          cancellable,
        )
      : null;
  if (digest !== model.sha256) {
    part.delete(null);
    throw new Error(
      _("The downloaded file is damaged. Please download it again."),
    );
  }

  part.move(target, Gio.FileCopyFlags.OVERWRITE, null, null);
}
