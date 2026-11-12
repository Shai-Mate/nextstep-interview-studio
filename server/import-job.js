import { fetchPublicPage } from "./network.js";
import { ServiceError } from "./errors.js";
import { extractJob } from "./job-extraction.js";

export { decodeHtml, plainText, extractJob } from "./job-extraction.js";

export async function importJob(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceError("INVALID_INPUT", "Provide a job-ad link.");
  const page = await fetchPublicPage(input.url, options);
  return extractJob(page.body, page.url);
}
