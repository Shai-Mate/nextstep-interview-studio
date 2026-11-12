// Bundle the existing production web app and its import API into one Worker.
// No candidate data, credentials, or external assets belong in this artifact.
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { build } from "esbuild";

const input = path.resolve("dist");
const output = path.resolve(process.argv[2] || "sites-build");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
const assets = Object.create(null);
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.isSymbolicLink())
      throw new Error("Unexpected hidden file or symlink in web build");
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else {
      const type = types[path.extname(file)];
      if (!type) throw new Error(`Unsupported public asset type: ${file}`);
      const bytes = await readFile(file);
      assets["/" + path.relative(input, file).split(path.sep).join("/")] = {
        base64: bytes.toString("base64"),
        type,
        size: bytes.length,
        etag:
          '"' +
          createHash("sha256").update(bytes).digest("hex").slice(0, 24) +
          '"',
      };
    }
  }
}
await collect(input);
if (!assets["/index.html"] || !assets["/sw.js"])
  throw new Error("Run npm run build before packaging Sites.");
await mkdir(path.join(output, "server"), { recursive: true });
const result = await build({
  entryPoints: ["server/worker.js"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  write: false,
  define: { __MOMENTUM_ASSETS__: JSON.stringify(assets) },
});
const worker = result.outputFiles[0].contents;
await writeFile(path.join(output, "server/index.js"), worker);
console.log(
  `Sites Worker: ${Object.keys(assets).length} embedded app files, ${worker.length} bytes; public job imports enabled, AI coaching disabled.`,
);
