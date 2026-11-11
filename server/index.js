import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { importJob } from "./import-job.js";
import { coach, aiAvailable, webResearchAvailable } from "./coach.js";
import { ServiceError, publicError } from "./errors.js";
import { createStaticHandler } from "./static.js";

export function readConfig(env = process.env) {
  const origins = (env.PRISM_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(
        "PRISM_ALLOWED_ORIGINS must contain exact origins separated by commas.",
      );
    }
    const exact =
      parsed.protocol === "capacitor:"
        ? `capacitor://${parsed.host}`
        : parsed.origin;
    if (
      exact !== origin ||
      !["https:", "http:", "capacitor:"].includes(parsed.protocol) ||
      (parsed.protocol === "capacitor:" && parsed.host !== "localhost")
    )
      throw new Error(
        "PRISM_ALLOWED_ORIGINS must contain exact origins, without paths.",
      );
  }
  return {
    port: Number(env.PORT || 8787),
    host: env.HOST || "127.0.0.1",
    environment: env.NODE_ENV || "development",
    apiKey: env.OPENAI_API_KEY || "",
    model: env.OPENAI_MODEL || "gpt-4.1-mini",
    serviceToken: env.PRISM_SERVICE_TOKEN || "",
    allowedOrigins: origins,
    enableWebResearch: env.PRISM_ENABLE_WEB_RESEARCH === "true",
    staticDir: env.PRISM_STATIC_DIR || "",
    operatorName: env.PRISM_OPERATOR_NAME || "",
    privacyUrl: env.PRISM_PRIVACY_URL || "",
    contactConfigured: Boolean(
      env.PRISM_SUPPORT_EMAIL || env.PRISM_SUPPORT_URL,
    ),
  };
}

function permittedHost(request, config) {
  let hostname;
  try {
    hostname = new URL(`http://${request.headers.host}`).hostname;
  } catch {
    return false;
  }
  const allowed = new Set([
    "localhost",
    "127.0.0.1",
    "[::1]",
    ...config.allowedOrigins.map((origin) => new URL(origin).hostname),
  ]);
  if (config.host && !["0.0.0.0", "::"].includes(config.host))
    allowed.add(config.host);
  return allowed.has(hostname);
}

function permittedOrigin(origin, request, config) {
  if (!origin) return true;
  if (config.allowedOrigins.includes(origin)) return true;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin !== origin) return false;
  if (
    ["https:", "http:"].includes(parsed.protocol) &&
    parsed.host === request.headers.host
  )
    return true;
  return (
    config.environment !== "production" &&
    ["http:", "https:"].includes(parsed.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
  );
}

function authorized(request, token) {
  if (!token) return true;
  const given = request.headers.authorization || "";
  const expected = `Bearer ${token}`;
  return (
    Buffer.byteLength(given) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  );
}

function readJson(request, maxBytes = 450000) {
  if (
    !/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] || "")
  )
    throw new ServiceError("CONTENT_TYPE", "Send this request as JSON.", 415);
  if (Number(request.headers["content-length"] || 0) > maxBytes)
    throw new ServiceError(
      "REQUEST_TOO_LARGE",
      "This request is too large. Shorten the job description or notes.",
      413,
    );
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        rejected = true;
        reject(
          new ServiceError(
            "REQUEST_TOO_LARGE",
            "This request is too large. Shorten the job description or notes.",
            413,
          ),
        );
      } else if (!rejected) chunks.push(chunk);
    });
    request.on("end", () => {
      if (rejected) return;
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw new Error("object required");
        resolve(value);
      } catch {
        reject(
          new ServiceError(
            "INVALID_JSON",
            "This request could not be read. Please try again.",
          ),
        );
      }
    });
    request.on("aborted", () =>
      reject(
        new ServiceError("REQUEST_ABORTED", "The request was interrupted."),
      ),
    );
    request.on("error", reject);
  });
}

export function createRateLimiter({
  now = Date.now,
  windowMs = 10 * 60 * 1000,
  maxEntries = 10000,
} = {}) {
  const entries = new Map();
  return (key, limit) => {
    const time = now();
    if (entries.size >= maxEntries)
      for (const [entryKey, value] of entries)
        if (value.expires <= time) entries.delete(entryKey);
    let entry = entries.get(key);
    if (!entry || entry.expires <= time) {
      if (entries.size >= maxEntries && !entries.has(key))
        throw new ServiceError(
          "RATE_LIMIT",
          "The service is busy. Please try again in a few minutes.",
          429,
        );
      entry = { count: 0, expires: time + windowMs };
      entries.set(key, entry);
    }
    entry.count++;
    if (entry.count > limit)
      throw new ServiceError(
        "RATE_LIMIT",
        "You have made several requests recently. Please wait a few minutes before trying again.",
        429,
      );
  };
}

export function createConcurrencyLimiter(limit) {
  let active = 0;
  return async (operation) => {
    if (active >= limit)
      throw new ServiceError(
        "SERVICE_BUSY",
        "The online service is busy. Please try again in a moment; your local tools are still available.",
        503,
      );
    active++;
    try {
      return await operation();
    } finally {
      active--;
    }
  };
}

export function createServer({
  config = readConfig(),
  importer = importJob,
  coaching = coach,
  limiter = createRateLimiter(),
} = {}) {
  const staticState = config.staticDir
    ? createStaticHandler(config.staticDir).then(
        (handler) => ({ ready: true, handler }),
        () => ({ ready: false, handler: null }),
      )
    : Promise.resolve({ ready: true, handler: null });
  const limitImports = createConcurrencyLimiter(4);
  const limitCoaching = createConcurrencyLimiter(2);
  const server = http.createServer(async (request, response) => {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      Vary: "Origin",
    };
    const send = (status, body) => {
      if (response.writableEnded || response.destroyed) return;
      if (status === 429) headers["Retry-After"] = "600";
      response.writeHead(status, headers);
      response.end(JSON.stringify(body));
    };
    try {
      if (!permittedHost(request, config))
        throw new ServiceError(
          "HOST_DENIED",
          "This service is not configured for this host address.",
          403,
        );
      const origin = request.headers.origin;
      if (!permittedOrigin(origin, request, config))
        throw new ServiceError(
          "ORIGIN_DENIED",
          "This service is not configured for this app address.",
          403,
        );
      if (origin) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
        headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
      }
      let pathname;
      try {
        pathname = new URL(request.url, "http://localhost").pathname;
      } catch {
        throw new ServiceError("INVALID_URL", "Invalid request path.");
      }
      if (request.method === "OPTIONS") {
        response.writeHead(204, headers);
        response.end();
        return;
      }
      if (
        ["/api/health", "/api/ready"].includes(pathname) &&
        request.method === "GET"
      ) {
        const staticAssets = await staticState;
        const ready = staticAssets.ready;
        send(pathname === "/api/ready" && !ready ? 503 : 200, {
          ok: true,
          ready,
          version: "1.0.0",
          capabilities: {
            jobImport: true,
            aiCoach: aiAvailable(config),
            webResearch: webResearchAvailable(config),
          },
          privacy: {
            storesContent: false,
            provider: "OpenAI",
            privacyUrl: config.privacyUrl,
            operatorName: config.operatorName,
            contactConfigured: config.contactConfigured,
          },
          model: config.model,
          deployment: { servesApp: Boolean(config.staticDir), appReady: ready },
        });
        return;
      }
      if (
        !pathname.startsWith("/api/") &&
        pathname !== "/api" &&
        config.staticDir
      ) {
        const assets = await staticState;
        if (!assets.ready)
          throw new ServiceError(
            "APP_NOT_READY",
            "The app is starting or its build is unavailable. Please try again shortly.",
            503,
          );
        if (await assets.handler(request, response, pathname)) return;
      }
      if (!["/api/import-job", "/api/coach"].includes(pathname))
        throw new ServiceError(
          "NOT_FOUND",
          "This endpoint does not exist.",
          404,
        );
      if (request.method !== "POST") {
        headers.Allow = "POST";
        throw new ServiceError(
          "METHOD_NOT_ALLOWED",
          "Use POST for this request.",
          405,
        );
      }
      if (!authorized(request, config.serviceToken))
        throw new ServiceError(
          "AUTH_REQUIRED",
          "This online service requires an authorized connection. Your local tools are still available.",
          401,
        );
      const address = request.socket.remoteAddress || "unknown";
      const isCoach = pathname === "/api/coach";
      limiter(`${address}:${isCoach ? "coach" : "import"}`, isCoach ? 10 : 25);
      limiter(isCoach ? "global:coach" : "global:import", isCoach ? 60 : 300);
      const result = await (isCoach ? limitCoaching : limitImports)(
        async () => {
          const body = await readJson(request);
          return isCoach ? coaching(body, config) : importer(body);
        },
      );
      send(200, result);
    } catch (error) {
      const output = publicError(error);
      send(output.status, output.body);
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 100;
  server.maxRequestsPerSocket = 100;
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const config = readConfig();
  const server = createServer({ config });
  server.listen(config.port, config.host, () => {
    console.log(
      `Momentum service listening on http://${config.host}:${config.port}. Online coaching: ${aiAvailable(config) ? "enabled" : "not configured"}.`,
    );
  });
  const shutdown = () => {
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => {
      server.closeAllConnections();
      process.exit(0);
    }, 10000).unref();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
