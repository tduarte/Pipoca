import {argv} from "node:process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {build} from "esbuild";

const [, , entryPoint, outdir] = argv;

if (entryPoint && outdir) {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(thisDir, "..");
  const tsconfig = path.join(repoRoot, "tsconfig.esbuild.json");

  await build({
    bundle: true,
    entryPoints: [entryPoint],
    external: ["gettext", "gi://*"],
    format: "esm",
    loader: {".ui": "text"},
    tsconfig,
    outdir: outdir,
    sourcemap: true,
    target: "es2022",
  });
}
