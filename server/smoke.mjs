import assert from "node:assert/strict";

const base = new URL(process.argv[2] || "http://127.0.0.1:8787");
if (
  !["http:", "https:"].includes(base.protocol) ||
  base.username ||
  base.password
)
  throw new Error("Provide an HTTP(S) app origin without credentials.");
const checks = [];
async function get(path, options = {}) {
  return fetch(new URL(path, base), {
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    ...options,
  });
}

const healthResponse = await get("/api/health");
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.ok, true);
assert.equal(health.privacy.storesContent, false);
assert.equal(healthResponse.headers.get("cache-control"), "no-store");
checks.push("API health and no-store policy");

const ready = await get("/api/ready");
assert.equal(ready.status, 200);
assert.equal((await ready.json()).ready, true);
checks.push("Service readiness");

const appResponse = await get("/");
assert.equal(appResponse.status, 200);
assert.match(appResponse.headers.get("content-type"), /text\/html/);
assert.match(
  appResponse.headers.get("content-security-policy"),
  /frame-ancestors 'none'/,
);
const html = await appResponse.text();
assert.match(html, /Momentum/);
const script = html.match(/<script[^>]+src="([^"]+)"/);
assert.ok(script, "The built app must include an external script.");
const asset = await get(script[1]);
assert.equal(asset.status, 200);
assert.match(asset.headers.get("content-type"), /javascript/);
assert.match(asset.headers.get("cache-control"), /immutable/);
checks.push(
  "Built app, script MIME type, security headers and immutable assets",
);

for (const path of [
  "/privacy.html",
  "/support.html",
  "/manifest.webmanifest",
  "/sw.js",
]) {
  const response = await get(path);
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get("cache-control"), "no-cache", path);
}
checks.push("Policy, support, manifest and updatable offline shell");

for (const path of [
  "/.env",
  "/server/index.js",
  "/api/not-found",
  "/assets/missing.js",
])
  assert.equal((await get(path)).status, 404, path);
checks.push("Private source and unknown endpoints remain inaccessible");

console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      capabilities: health.capabilities,
      note: "Read-only smoke verification; no external website, AI or search provider was called.",
    },
    null,
    2,
  ),
);
