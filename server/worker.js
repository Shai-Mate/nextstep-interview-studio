import { importWorkerJob } from "./worker-import.js";
import { ServiceError, publicError } from "./errors.js";

const API_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...API_HEADERS,
      ...(status === 429 ? { "Retry-After": "600" } : {}),
    },
  });
}

async function readInput(request) {
  if (!/^application\/json\b/i.test(request.headers.get("Content-Type") || ""))
    throw new ServiceError(
      "INVALID_CONTENT_TYPE",
      "Please send a job link as JSON.",
      415,
    );
  const maxBytes = 8192;
  if (Number(request.headers.get("Content-Length")) > maxBytes)
    throw new ServiceError(
      "REQUEST_TOO_LARGE",
      "This link is too long. Paste the job description instead.",
      413,
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new ServiceError("INVALID_JSON", "Add a job link to continue.");
  const chunks = [];
  let size = 0;
  let expired = false;
  const timeout = setTimeout(() => {
    expired = true;
    reader.cancel().catch(() => {});
  }, 8000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (expired)
        throw new ServiceError(
          "REQUEST_TIMEOUT",
          "The request timed out. Please try again.",
          408,
        );
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ServiceError(
          "REQUEST_TOO_LARGE",
          "This link is too long. Paste the job description instead.",
          413,
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let value;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new ServiceError(
        "INVALID_JSON",
        "This link could not be read. Please try again.",
      );
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new ServiceError("INVALID_JSON", "Add a job link to continue.");
    return value;
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
}

// This preview is protected by Sites' owner-only sign-in. These limits bound
// work inside each isolate; they are not a substitute for platform access rules.
export function createWorker({
  assets = {},
  importer = importWorkerJob,
  now = Date.now,
} = {}) {
  let active = 0;
  let count = 0;
  let windowEnd = 0;
  return {
    async fetch(request) {
      try {
        const url = new URL(request.url);
        const pathname = url.pathname;
        if (pathname.startsWith("/api/") || pathname === "/api") {
          const origin = request.headers.get("Origin");
          if (
            (origin && origin !== url.origin) ||
            request.headers.get("Sec-Fetch-Site") === "cross-site"
          )
            throw new ServiceError(
              "ORIGIN_DENIED",
              "Open Momentum to use this service.",
              403,
            );
          if (
            ["/api/health", "/api/ready"].includes(pathname) &&
            request.method === "GET"
          )
            return json({
              ok: true,
              ready: Boolean(assets["/index.html"]),
              version: "1.0.1",
              capabilities: {
                jobImport: true,
                aiCoach: false,
                webResearch: false,
              },
              privacy: { storesContent: false, operatorName: "Prism" },
              deployment: {
                servesApp: true,
                appReady: Boolean(assets["/index.html"]),
                runtime: "worker",
              },
            });
          if (!["/api/import-job", "/api/coach"].includes(pathname))
            throw new ServiceError(
              "NOT_FOUND",
              "This endpoint does not exist.",
              404,
            );
          if (request.method !== "POST")
            throw new ServiceError(
              "METHOD_NOT_ALLOWED",
              "Use POST for this request.",
              405,
            );
          if (pathname === "/api/coach")
            throw new ServiceError(
              "COACH_NOT_CONFIGURED",
              "Online AI coaching is not connected in this preview. Your preparation tools still work on this device.",
              503,
            );
          if (active >= 4)
            throw new ServiceError(
              "SERVICE_BUSY",
              "The import service is busy. Please try again shortly.",
              503,
            );
          const time = now();
          if (time >= windowEnd) {
            count = 0;
            windowEnd = time + 600000;
          }
          if (++count > 60)
            throw new ServiceError(
              "RATE_LIMIT",
              "You have imported several links recently. Please wait a few minutes or paste the description.",
              429,
            );
          active++;
          try {
            return json(await importer(await readInput(request)));
          } finally {
            active--;
          }
        }

        if (!["GET", "HEAD"].includes(request.method))
          return new Response("Method not allowed", {
            status: 405,
            headers: { Allow: "GET, HEAD" },
          });
        const asset = assets[pathname === "/" ? "/index.html" : pathname];
        if (!asset)
          return new Response("Not found", {
            status: 404,
            headers: { "Cache-Control": "no-store" },
          });
        const headers = {
          "Content-Type": asset.type,
          "Content-Length": String(asset.size),
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Cache-Control": pathname.startsWith("/assets/")
            ? "private, max-age=31536000, immutable"
            : "no-cache",
          ETag: asset.etag,
          ...(pathname === "/sw.js" ? { "Service-Worker-Allowed": "/" } : {}),
        };
        if (request.headers.get("If-None-Match") === asset.etag)
          return new Response(null, { status: 304, headers });
        if (request.method === "HEAD") return new Response(null, { headers });
        const data = Uint8Array.from(atob(asset.base64), (character) =>
          character.charCodeAt(0),
        );
        return new Response(data, { headers });
      } catch (error) {
        const result = publicError(error);
        return json(result.body, result.status);
      }
    },
  };
}

export default createWorker({
  assets: typeof __MOMENTUM_ASSETS__ === "undefined" ? {} : __MOMENTUM_ASSETS__,
});
