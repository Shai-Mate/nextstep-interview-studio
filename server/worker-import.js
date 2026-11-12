import { ServiceError } from "./errors.js";
import { extractJob, plainText } from "./job-extraction.js";

const TIMEOUT_MS = 12000;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;

// Workers cannot pin a previously validated DNS address like the Node service.
// Restrict this private preview to established public job platforms instead of
// fetching arbitrary user-controlled domains that could resolve privately.
export const SUPPORTED_JOB_HOSTS = Object.freeze([
  "indeed.com",
  "indeed.ca",
  "indeed.co.uk",
  "indeed.com.au",
  "indeed.fr",
  "indeed.de",
  "linkedin.com",
  "greenhouse.io",
  "greenhouse.com",
  "lever.co",
  "ashbyhq.com",
  "smartrecruiters.com",
  "myworkdayjobs.com",
  "workable.com",
  "applytojob.com",
  "jobvite.com",
  "icims.com",
  "bamboohr.com",
  "recruitee.com",
  "personio.com",
  "personio.de",
  "teamtailor.com",
  "ziprecruiter.com",
  "glassdoor.com",
  "monster.com",
]);

export function parseWorkerJobUrl(input, allowedHosts = SUPPORTED_JOB_HOSTS) {
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
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !host.includes(".") ||
    /^\d+(?:\.\d+){3}$/.test(host) ||
    host.startsWith("[") ||
    /(^|\.)(localhost|local|internal|invalid|test)$/.test(host)
  )
    throw new ServiceError(
      "UNSAFE_URL",
      "Use a public HTTPS job link without a password or a custom port.",
    );
  if (
    !allowedHosts.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    )
  )
    throw new ServiceError(
      "UNSUPPORTED_JOB_HOST",
      "This preview imports links from supported job boards and hiring platforms. For this website, open the job ad and paste its description below.",
      422,
    );
  url.hostname = host;
  url.hash = "";
  return url;
}

function blockedPage(url) {
  const source = /(^|\.)indeed\./.test(url.hostname)
    ? "Indeed"
    : /(^|\.)linkedin\.com$/.test(url.hostname)
      ? "LinkedIn"
      : "This job site";
  return new ServiceError(
    "SITE_BLOCKED",
    `${source} requires a browser or sign-in to view this page. Open the job ad, copy the description, then use Paste text to continue.`,
    422,
  );
}

function hasAccessChallenge(html) {
  const title = plainText(
    html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || "",
  );
  return (
    /^(?:just a moment(?:\.\.\.)?|access denied|security check|sign in|log in)(?:\s|[|:!–—-]|$)/i.test(
      title,
    ) ||
    /verify (?:that )?you are human|enable javascript and cookies to continue|checking (?:your )?browser before accessing|complete the security check to access/i.test(
      plainText(html).slice(0, 12000),
    )
  );
}

async function readPage(response, maxBytes, signal) {
  const declaredSize = Number(response.headers.get("content-length") || 0);
  const tooLarge = () =>
    new ServiceError(
      "PAGE_TOO_LARGE",
      "That page is too large to import. Copy and paste the job description instead.",
      422,
    );
  if (declaredSize > maxBytes) {
    await response.body?.cancel();
    throw tooLarge();
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const cancel = () => {
    reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder();
  let size = 0;
  const parts = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw new Error("aborted");
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw tooLarge();
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export async function fetchWorkerJobPage(
  input,
  {
    fetcher = fetch,
    allowedHosts = SUPPORTED_JOB_HOSTS,
    timeoutMs = TIMEOUT_MS,
    maxBytes = MAX_PAGE_BYTES,
  } = {},
) {
  let url = parseWorkerJobUrl(input, allowedHosts);
  const controller = new AbortController();
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(
        new ServiceError(
          "IMPORT_TIMEOUT",
          "This job site took too long to respond. Open the ad and paste its description instead.",
          504,
        ),
      );
    }, timeoutMs);
  });
  const operation = (async () => {
    for (let hop = 0; hop <= 3; hop++) {
      if (controller.signal.aborted) throw new Error("aborted");
      if (/\/(?:authwall|login|signin|checkpoint)(?:\/|$)/i.test(url.pathname))
        throw blockedPage(url);
      const response = await fetcher(url.href, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "MomentumByPrism/1.0 (public job description importer)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (hop === 3 || !location)
          throw new ServiceError(
            "REDIRECT_LIMIT",
            "This link redirects too many times. Open the final job page and paste its link or text.",
            422,
          );
        let next;
        try {
          next = new URL(location, url).href;
        } catch {
          throw new ServiceError(
            "INVALID_URL",
            "This job page returned an invalid link. Paste the description instead.",
            422,
          );
        }
        url = parseWorkerJobUrl(next, allowedHosts);
        continue;
      }
      if ([401, 403, 429].includes(response.status)) {
        await response.body?.cancel();
        throw blockedPage(url);
      }
      if ([404, 410].includes(response.status)) {
        await response.body?.cancel();
        throw new ServiceError(
          "JOB_NOT_FOUND",
          "This job page is no longer available at that link. Check the ad, or paste a copy of its description.",
          422,
        );
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new ServiceError(
          "SITE_UNAVAILABLE",
          "This job site could not be reached right now. Try again or paste the job description.",
          422,
        );
      }
      if (
        !/^(text\/html|application\/xhtml\+xml|text\/plain)(?:\s*;|$)/i.test(
          response.headers.get("content-type") || "",
        )
      ) {
        await response.body?.cancel();
        throw new ServiceError(
          "UNSUPPORTED_PAGE",
          "That link is not a text job page. Upload a supported document or paste its text instead.",
          422,
        );
      }
      const body = await readPage(response, maxBytes, controller.signal);
      if (hasAccessChallenge(body)) throw blockedPage(url);
      return { body, url: url.href };
    }
  })();
  try {
    return await Promise.race([operation, timer]);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (controller.signal.aborted)
      throw new ServiceError(
        "IMPORT_TIMEOUT",
        "This job site took too long to respond. Paste the description instead.",
        504,
      );
    throw new ServiceError(
      "SITE_UNAVAILABLE",
      "This job site could not be imported. It may require a browser or sign-in. Open the ad and paste its description instead.",
      422,
    );
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

export async function importWorkerJob(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceError("INVALID_INPUT", "Provide a job-ad link.");
  const page = await fetchWorkerJobPage(input.url, options);
  return extractJob(page.body, page.url);
}
