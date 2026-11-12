import https from "node:https";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { gunzipSync, brotliDecompressSync, inflateSync } from "node:zlib";
import { ServiceError } from "./errors.js";

const TIMEOUT_MS = 12000;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;

/** Only globally routable addresses may be used for user-provided websites. */
export function isPublicAddress(address) {
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
      return false;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (version === 6) {
    // Limit to global unicast; exclude transition, benchmarking and documentation ranges.
    const first = parseInt(address.split(":")[0] || "0", 16);
    if (first < 0x2000 || first > 0x3fff) return false;
    const normalized = address.toLowerCase();
    if (normalized.includes(".") || normalized.startsWith("2002:"))
      return false;
    if (/^2001:(?:0{0,3}[0-9a-f]{1,2}|0?1[0-9a-f]{2}):/.test(normalized))
      return false;
    if (/^2001:0?db8:/.test(normalized) || /^3fff:/.test(normalized))
      return false;
    return true;
  }
  return false;
}

export function parsePublicUrl(input) {
  if (typeof input !== "string" || input.length > 2000)
    throw new ServiceError(
      "INVALID_URL",
      "Paste a public HTTPS job-ad link, up to 2,000 characters.",
    );
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ServiceError(
      "INVALID_URL",
      "That link does not look right. Include https:// and try again.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new ServiceError(
      "UNSAFE_URL",
      "Use a public HTTPS link without a password or a custom port.",
    );
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !hostname.includes(".") ||
    isIP(hostname) ||
    hostname.startsWith("[") ||
    /(^|\.)(localhost|local|internal|localhost\.localdomain|invalid|test)$/.test(
      hostname,
    )
  ) {
    throw new ServiceError(
      "UNSAFE_URL",
      "This importer accepts public websites only. Paste the job description instead.",
    );
  }
  url.hostname = hostname;
  url.hash = "";
  return url;
}

export async function resolvePublicHost(url, lookup = dnsLookup) {
  let addresses;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new ServiceError(
      "SITE_UNAVAILABLE",
      "That website could not be reached. Check the link or paste the job description.",
      422,
    );
  }
  if (
    !addresses.length ||
    addresses.some((item) => !isPublicAddress(item.address))
  ) {
    throw new ServiceError(
      "UNSAFE_URL",
      "This link does not point to an accessible public website. Paste the job description instead.",
    );
  }
  return addresses;
}

/** Requests resolve once and pin the validated IP, preventing DNS rebinding. */
export function requestPinned(
  url,
  addresses,
  { signal, maxBytes = MAX_PAGE_BYTES } = {},
) {
  return new Promise((resolve, reject) => {
    const address = addresses.find((a) => a.family === 4) || addresses[0];
    const request = https.request(
      url,
      {
        method: "GET",
        signal,
        headers: {
          "User-Agent": "MomentumByPrism/1.0 (public job description importer)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
          "Accept-Encoding": "identity",
        },
        lookup(_hostname, options, done) {
          if (options.all) done(null, [address]);
          else done(null, address.address, address.family);
        },
        // Environment proxy support is deliberately opt-in: a trusted proxy must enforce
        // private-network denial because CONNECT proxies perform their own DNS lookup.
        agent:
          process.env.PRISM_TRUST_ENV_PROXY === "1"
            ? new https.Agent({ proxyEnv: process.env, maxSockets: 8 })
            : undefined,
      },
      (response) => {
        let size = 0;
        const chunks = [];
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            request.destroy(
              new ServiceError(
                "PAGE_TOO_LARGE",
                "That page is too large to import. Copy and paste the job description instead.",
                422,
              ),
            );
          } else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          let bytes = Buffer.concat(chunks);
          const encoding = String(response.headers["content-encoding"] || "")
            .trim()
            .toLowerCase();
          try {
            if (encoding === "gzip")
              bytes = gunzipSync(bytes, { maxOutputLength: maxBytes });
            else if (encoding === "br")
              bytes = brotliDecompressSync(bytes, {
                maxOutputLength: maxBytes,
              });
            else if (encoding === "deflate")
              bytes = inflateSync(bytes, { maxOutputLength: maxBytes });
            else if (encoding && encoding !== "identity")
              throw new Error("unsupported encoding");
          } catch {
            reject(
              new ServiceError(
                "UNSUPPORTED_PAGE",
                "This website could not be decoded safely. Copy and paste the job description instead.",
                422,
              ),
            );
            return;
          }
          resolve({
            status: response.statusCode || 502,
            headers: response.headers,
            body: bytes.toString("utf8"),
          });
        });
      },
    );
    request.on("error", (error) => {
      if (error instanceof ServiceError) reject(error);
      else if (signal?.aborted)
        reject(
          new ServiceError(
            "IMPORT_TIMEOUT",
            "This website took too long to respond. Paste the job description instead.",
            504,
          ),
        );
      else
        reject(
          new ServiceError(
            "SITE_UNAVAILABLE",
            "That website could not be imported. It may block imports or require a sign-in. Paste the job text instead.",
            422,
          ),
        );
    });
    request.end();
  });
}

export async function fetchPublicPage(
  input,
  { lookup = dnsLookup, request = requestPinned, timeoutMs = TIMEOUT_MS } = {},
) {
  let url = parsePublicUrl(input);
  const controller = new AbortController();
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(
        new ServiceError(
          "IMPORT_TIMEOUT",
          "This website took too long to respond. Paste the job description instead.",
          504,
        ),
      );
    }, timeoutMs);
    timeout.unref?.();
  });
  const operation = (async () => {
    for (let hop = 0; hop <= 3; hop++) {
      const addresses = await resolvePublicHost(url, lookup);
      if (controller.signal.aborted)
        throw new ServiceError(
          "IMPORT_TIMEOUT",
          "This website took too long to respond.",
          504,
        );
      const result = await request(url, addresses, {
        signal: controller.signal,
      });
      if ([301, 302, 303, 307, 308].includes(result.status)) {
        if (hop === 3 || !result.headers.location)
          throw new ServiceError(
            "REDIRECT_LIMIT",
            "This link redirects too many times. Open the final job page and paste its link or text.",
            422,
          );
        url = parsePublicUrl(new URL(result.headers.location, url).href);
        continue;
      }
      if (result.status < 200 || result.status >= 300)
        throw new ServiceError(
          "SITE_UNAVAILABLE",
          "This website blocked the import or could not find the page. Paste the job description instead.",
          422,
        );
      const contentType = String(
        result.headers["content-type"] || "",
      ).toLowerCase();
      if (
        !/^(text\/html|application\/xhtml\+xml|text\/plain)(?:;|$)/.test(
          contentType,
        )
      )
        throw new ServiceError(
          "UNSUPPORTED_PAGE",
          "That link is not a text job page. Upload a supported document or paste its text instead.",
          422,
        );
      return { ...result, url: url.href };
    }
  })();
  try {
    return await Promise.race([operation, timer]);
  } finally {
    clearTimeout(timeout);
  }
}

/** Fixed-provider JSON request, with inherited proxy and CA trust preserved. */
export function requestProvider(
  url,
  body,
  headers = {},
  { timeoutMs = 45000, maxBytes = 1024 * 1024 } = {},
) {
  return new Promise((resolve, reject) => {
    const bytes = Buffer.from(JSON.stringify(body));
    const signal = AbortSignal.timeout(timeoutMs);
    const request = https.request(
      url,
      {
        method: "POST",
        signal,
        agent: new https.Agent({ proxyEnv: process.env, maxSockets: 8 }),
        headers: {
          "Content-Type": "application/json",
          "Content-Length": bytes.length,
          ...headers,
        },
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxBytes)
            request.destroy(
              new ServiceError(
                "PROVIDER_RESPONSE",
                "The coaching response was too large. Please try a smaller request.",
                502,
              ),
            );
          else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    request.setTimeout(timeoutMs, () =>
      request.destroy(
        new ServiceError(
          "COACH_TIMEOUT",
          "The coach took too long to respond. Your local preparation is still available.",
          504,
        ),
      ),
    );
    request.on("error", (error) =>
      reject(
        error instanceof ServiceError
          ? error
          : signal.aborted
            ? new ServiceError(
                "COACH_TIMEOUT",
                "The coach took too long to respond. Your local preparation is still available.",
                504,
              )
            : new ServiceError(
                "COACH_UNAVAILABLE",
                "Online coaching could not be reached. Try again later or continue with your local plan.",
                502,
              ),
      ),
    );
    request.end(bytes);
  });
}
