import {argv} from "node:process";
import {build} from "esbuild";

const [, , entryPoint, outdir] = argv;

if (entryPoint && outdir) {
  await build({
    bundle: true,
    entryPoints: [entryPoint],
    external: ["gettext", "gi://*"],
    format: "esm",
    loader: {".ui": "text"},
    outdir: outdir,
    sourcemap: true,
    target: "es2022",
  });
}
