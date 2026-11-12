import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../server/worker.js";
import { ServiceError } from "../server/errors.js";

const origin = "https://momentum.example";
function request(path, body, headers = {}) {
  return new Request(
    origin + path,
    body === undefined
      ? { headers }
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: origin,
            ...headers,
          },
          body: JSON.stringify(body),
        },
  );
}
const html = "<!doctype html><title>Momentum</title>";
const asset = {
  base64: btoa(html),
  size: html.length,
  type: "text/html; charset=utf-8",
  etag: '"release"',
};
const assets = {
  "/index.html": asset,
  "/sw.js": { ...asset, type: "text/javascript" },
};

test("Worker serves app and real API on one origin without SPA fallback for missing API routes", async () => {
  let imported;
  const worker = createWorker({
    assets,
    importer: async (input) => {
      imported = input;
      return {
        job: { text: "Imported responsibilities", url: input.url },
        warnings: [],
      };
    },
  });
  const home = await worker.fetch(request("/"));
  assert.equal(await home.text(), html);
  assert.equal(home.headers.get("cache-control"), "no-cache");
  const health = await (await worker.fetch(request("/api/health"))).json();
  assert.deepEqual(health.capabilities, {
    jobImport: true,
    aiCoach: false,
    webResearch: false,
  });
  assert.equal(health.ready, true);
  const response = await worker.fetch(
    request("/api/import-job", {
      url: "https://boards.greenhouse.io/example/jobs/123",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).job.url, imported.url);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const missing = await worker.fetch(request("/api/missing"));
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "NOT_FOUND");
  assert.equal((await worker.fetch(request("/.env"))).status, 404);
});

test("Worker rejects cross-origin calls, malformed and excessive bodies before importing", async () => {
  let calls = 0;
  const worker = createWorker({
    importer: async () => {
      calls++;
      return {};
    },
  });
  const foreign = await worker.fetch(
    request(
      "/api/import-job",
      { url: "https://example.com" },
      { Origin: "https://other.example" },
    ),
  );
  assert.equal(foreign.status, 403);
  assert.equal((await foreign.json()).error.code, "ORIGIN_DENIED");
  const array = await worker.fetch(request("/api/import-job", []));
  assert.equal(array.status, 400);
  const big = await worker.fetch(
    request("/api/import-job", { url: "x".repeat(9000) }),
  );
  assert.equal(big.status, 413);
  const wrongType = await worker.fetch(
    request("/api/import-job", {}, { "Content-Type": "text/plain" }),
  );
  assert.equal(wrongType.status, 415);
  assert.equal(calls, 0);
});

test("Worker preserves import errors and does not expose unexpected exception details", async () => {
  const blocked = createWorker({
    importer: async () => {
      throw new ServiceError(
        "SITE_BLOCKED",
        "Open this job page and paste its description.",
        422,
      );
    },
  });
  const response = await blocked.fetch(
    request("/api/import-job", { url: "https://indeed.com/viewjob" }),
  );
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, "SITE_BLOCKED");
  const broken = createWorker({
    importer: async () => {
      throw new Error("secret runtime details");
    },
  });
  const failure = await broken.fetch(request("/api/import-job", {}));
  assert.equal(failure.status, 500);
  assert.doesNotMatch(await failure.text(), /secret runtime details/);
});

test("Worker bounds concurrent imports and releases capacity after failure", async () => {
  const pending = [];
  const worker = createWorker({
    importer: () =>
      new Promise((resolve, reject) => pending.push({ resolve, reject })),
  });
  const calls = Array.from({ length: 4 }, () =>
    worker.fetch(request("/api/import-job", {})),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(pending.length, 4);
  const busy = await worker.fetch(request("/api/import-job", {}));
  assert.equal(busy.status, 503);
  assert.equal((await busy.json()).error.code, "SERVICE_BUSY");
  pending[0].reject(new Error("failure"));
  pending.slice(1).forEach(({ resolve }) => resolve({ job: {} }));
  await Promise.all(calls);
  const next = worker.fetch(request("/api/import-job", {}));
  await new Promise((resolve) => setTimeout(resolve, 0));
  pending[4].resolve({ job: {} });
  assert.equal((await next).status, 200);
});

test("Worker throttles sustained imports and resumes after the limit window", async () => {
  let time = 1;
  const worker = createWorker({
    now: () => time,
    importer: async () => ({ job: {} }),
  });
  for (let i = 0; i < 60; i++)
    assert.equal(
      (await worker.fetch(request("/api/import-job", {}))).status,
      200,
    );
  const limited = await worker.fetch(request("/api/import-job", {}));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "600");
  time += 600000;
  assert.equal(
    (await worker.fetch(request("/api/import-job", {}))).status,
    200,
  );
});

test("Worker honours static HEAD and ETag and marks service worker for revalidation", async () => {
  const worker = createWorker({ assets });
  const head = await worker.fetch(
    new Request(origin + "/", { method: "HEAD" }),
  );
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("content-length"), String(html.length));
  const unchanged = await worker.fetch(
    request("/", undefined, { "If-None-Match": asset.etag }),
  );
  assert.equal(unchanged.status, 304);
  const sw = await worker.fetch(request("/sw.js"));
  assert.equal(sw.headers.get("service-worker-allowed"), "/");
  assert.equal(sw.headers.get("cache-control"), "no-cache");
});
