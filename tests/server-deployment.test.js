import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import {
  createServer,
  readConfig,
  createConcurrencyLimiter,
} from "../server/index.js";
import { validateCoachInput } from "../server/coach.js";

async function fixture(callback) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "momentum-deployment-"),
  );
  const root = path.join(directory, "dist");
  await mkdir(path.join(root, "assets"), { recursive: true });
  await writeFile(
    path.join(root, "index.html"),
    '<!doctype html><title>Momentum</title><script src="/assets/app-abcdefgh.js"></script>',
  );
  await writeFile(
    path.join(root, "assets", "app-abcdefgh.js"),
    'console.log("Momentum");',
  );
  await writeFile(path.join(root, "sw.js"), "/* offline shell */");
  await writeFile(path.join(root, "privacy.html"), "<title>Privacy</title>");
  await writeFile(path.join(root, ".env"), "DO_NOT_SERVE=private");
  await writeFile(
    path.join(directory, "secret.txt"),
    "outside the public build",
  );
  await symlink(
    path.join(directory, "secret.txt"),
    path.join(root, "linked.txt"),
  );
  const config = readConfig({ NODE_ENV: "production", PRISM_STATIC_DIR: root });
  const server = createServer({ config });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await callback({ base, directory, root, server });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

function rawGet(base, pathname) {
  return new Promise((resolve, reject) => {
    const url = new URL(base);
    http
      .get(
        { hostname: url.hostname, port: url.port, path: pathname },
        (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () =>
            resolve({
              status: response.statusCode,
              text: Buffer.concat(chunks).toString(),
            }),
          );
        },
      )
      .on("error", reject);
  });
}

test("production server serves app and API on one origin with appropriate caching and security headers", async () => {
  await fixture(async ({ base }) => {
    const app = await fetch(base);
    assert.equal(app.status, 200);
    assert.equal(app.headers.get("cache-control"), "no-cache");
    assert.match(app.headers.get("content-type"), /text\/html/);
    assert.match(
      app.headers.get("content-security-policy"),
      /connect-src 'self';/,
    );
    assert.match(
      app.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
    assert.equal(app.headers.get("x-frame-options"), "DENY");
    assert.match(await app.text(), /Momentum/);
    const asset = await fetch(`${base}/assets/app-abcdefgh.js`);
    assert.match(asset.headers.get("content-type"), /javascript/);
    assert.equal(
      asset.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
    );
    const etag = asset.headers.get("etag");
    assert.equal(
      (
        await fetch(`${base}/assets/app-abcdefgh.js`, {
          headers: { "If-None-Match": etag },
        })
      ).status,
      304,
    );
    const head = await fetch(`${base}/assets/app-abcdefgh.js`, {
      method: "HEAD",
    });
    assert.equal(head.status, 200);
    assert.ok(Number(head.headers.get("content-length")) > 0);
    assert.equal(await head.text(), "");
    const sw = await fetch(`${base}/sw.js`);
    assert.equal(sw.headers.get("cache-control"), "no-cache");
    assert.equal(sw.headers.get("service-worker-allowed"), "/");
    const ready = await fetch(`${base}/api/ready`);
    assert.equal(ready.status, 200);
    const body = await ready.json();
    assert.equal(body.ready, true);
    assert.deepEqual(body.deployment, { servesApp: true, appReady: true });
    assert.doesNotMatch(JSON.stringify(body), /momentum-deployment-/);
  });
});

test("static server blocks traversal, dotfiles, source files, symlink escapes and unknown API routes", async () => {
  await fixture(async ({ base }) => {
    for (const pathname of [
      "/.env",
      "/%2eenv",
      "/%2e%2e%2fsecret.txt",
      "/%2e%2e%5csecret.txt",
      "/linked.txt",
      "/server/index.js",
      "/assets/missing.js",
      "/assets/app-abcdefgh.js.map",
      "/api/unknown",
    ]) {
      const response = await rawGet(base, pathname);
      assert.equal(response.status, 404, pathname);
      assert.doesNotMatch(
        response.text,
        /DO_NOT_SERVE|outside the public build/,
      );
    }
    const malformed = await rawGet(base, "/%E0%A4%A");
    assert.equal(malformed.status, 404);
    const page = await fetch(`${base}/opportunities`, {
      headers: { Accept: "text/html" },
    });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Momentum/);
    assert.equal(
      (await fetch(`${base}/api/unknown`, { headers: { Accept: "text/html" } }))
        .status,
      404,
    );
  });
});

test("readiness fails when a configured app build is absent while liveness remains available", async () => {
  const server = createServer({
    config: readConfig({
      PRISM_STATIC_DIR: "/nonexistent-momentum-build-for-test",
    }),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    const ready = await fetch(`${base}/api/ready`);
    assert.equal(ready.status, 503);
    assert.equal((await ready.json()).ready, false);
    assert.equal((await fetch(base)).status, 503);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("concurrent expensive work is bounded and capacity recovers after completion or failure", async () => {
  const limiter = createConcurrencyLimiter(2);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const first = limiter(async () => {
    await gate;
    return "first";
  });
  const second = limiter(async () => {
    await gate;
    return "second";
  });
  await assert.rejects(
    limiter(() => "third"),
    (error) => error.code === "SERVICE_BUSY" && error.status === 503,
  );
  release();
  assert.deepEqual(await Promise.all([first, second]), ["first", "second"]);
  await assert.rejects(
    limiter(() => {
      throw new Error("failed operation");
    }),
    /failed operation/,
  );
  assert.equal(await limiter(() => "recovered"), "recovered");
});

test("coaching accepts full UI-sized job and resume inputs, but rejects oversized combined context without truncation", () => {
  const job = "職".repeat(60000);
  const resume = "履".repeat(60000);
  const input = {
    consent: true,
    action: "application",
    job: { text: job },
    profile: { resume },
    context: { lesson: "A focused exercise" },
  };
  const validated = validateCoachInput(input);
  assert.equal(validated.job.text, job);
  assert.equal(validated.profile.resume, resume);
  assert.throws(
    () =>
      validateCoachInput({ ...input, context: { notes: "n".repeat(25000) } }),
    (error) =>
      error.code === "INVALID_INPUT" &&
      error.message.includes("140,000") &&
      error.message.includes("nothing has been truncated"),
  );
  assert.throws(
    () =>
      validateCoachInput({ ...input, profile: { resume: "x".repeat(60001) } }),
    (error) => error.code === "INVALID_INPUT",
  );
});

test("UTF-8 UI-sized payloads fit the transfer bound before coaching validation", async () => {
  let received;
  const server = createServer({
    config: readConfig({}),
    coaching: async (input) => {
      received = validateCoachInput(input);
      return { result: { title: "Accepted" } };
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/coach`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: true,
          action: "application",
          job: { text: "職".repeat(60000) },
          profile: { resume: "履".repeat(60000) },
        }),
      },
    );
    assert.equal(response.status, 200);
    assert.equal(received.profile.resume.length, 60000);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("coaching accepts the practice editor answer limit without silent truncation", () => {
  const answer = "a".repeat(20000);
  assert.equal(
    validateCoachInput({
      consent: true,
      action: "interview-feedback",
      question: "What did you do?",
      answer,
    }).answer,
    answer,
  );
  assert.throws(
    () =>
      validateCoachInput({
        consent: true,
        action: "interview-feedback",
        question: "What did you do?",
        answer: answer + "a",
      }),
    (error) => error.code === "INVALID_INPUT",
  );
});
