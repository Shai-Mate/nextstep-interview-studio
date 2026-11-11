import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".otf", "font/otf"],
  [".wasm", "application/wasm"],
  [".txt", "text/plain; charset=utf-8"],
]);

export const STATIC_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";

function within(root, filename) {
  return filename === root || filename.startsWith(root + path.sep);
}

export async function createStaticHandler(directory) {
  const root = await realpath(directory);
  const entry = await realpath(path.join(root, "index.html"));
  if (!within(root, entry) || !(await stat(entry)).isFile())
    throw new Error("The static app build is unavailable.");

  return async function serveStatic(request, response, pathname) {
    if (!["GET", "HEAD"].includes(request.method)) return false;
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return false;
    }
    const segments = decoded.split("/");
    if (
      decoded.includes("\\") ||
      decoded.includes("\0") ||
      segments.some((segment) => segment.startsWith("."))
    )
      return false;
    let filename = path.join(root, decoded === "/" ? "index.html" : decoded);
    if (!within(root, filename)) return false;
    let info;
    try {
      filename = await realpath(filename);
      if (!within(root, filename)) return false;
      info = await stat(filename);
    } catch {
      // The app uses local navigation; extensionless links can still reopen its shell.
      if (
        path.extname(decoded) ||
        !String(request.headers.accept || "").includes("text/html")
      )
        return false;
      filename = entry;
      info = await stat(entry);
    }
    if (!info.isFile()) return false;
    const type = MIME_TYPES.get(path.extname(filename).toLowerCase());
    if (!type) return false;
    const immutable =
      filename.startsWith(path.join(root, "assets") + path.sep) &&
      /-[\w-]{8,}\.[a-z\d]+$/i.test(filename);
    const etag = `W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
    const headers = {
      "Content-Type": type,
      "Cache-Control": immutable
        ? "public, max-age=31536000, immutable"
        : "no-cache",
      "Content-Security-Policy": STATIC_CSP,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), geolocation=(), payment=()",
      "Cross-Origin-Resource-Policy": "same-origin",
      ETag: etag,
      "Last-Modified": info.mtime.toUTCString(),
    };
    if (path.basename(filename) === "sw.js")
      headers["Service-Worker-Allowed"] = "/";
    if (request.headers["if-none-match"] === etag) {
      response.writeHead(304, headers);
      response.end();
      return true;
    }
    response.writeHead(200, { ...headers, "Content-Length": info.size });
    if (request.method === "HEAD") response.end();
    else {
      try {
        await pipeline(createReadStream(filename), response);
      } catch {
        response.destroy();
      }
    }
    return true;
  };
}
