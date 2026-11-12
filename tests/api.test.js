import test from "node:test";
import assert from "node:assert/strict";
import { requestAPI } from "../src/lib/api.js";

test("a blocked job site retains its code and status for actionable recovery", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      {
        error: {
          code: "SITE_BLOCKED",
          message: "This job site requires a browser or sign-in.",
        },
      },
      { status: 422 },
    ),
  );
  await assert.rejects(
    requestAPI("import-job", { url: "https://ca.indeed.com/viewjob" }),
    (error) =>
      error.code === "SITE_BLOCKED" &&
      error.status === 422 &&
      error.message === "This job site requires a browser or sign-in.",
  );
});

test("an HTML fallback is classified as an unavailable service, not a blocked job site", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("<html>Not found</html>", {
        status: 404,
        headers: { "Content-Type": "text/html" },
      }),
  );
  await assert.rejects(
    requestAPI("import-job", { url: "https://example.com" }),
    {
      code: "SERVICE_UNAVAILABLE",
      status: 404,
    },
  );
});

test("a network failure is classified as an unavailable service", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    requestAPI("import-job", { url: "https://example.com" }),
    {
      code: "SERVICE_UNAVAILABLE",
    },
  );
});

test("a successful import retains the job data and review warnings", async (t) => {
  const result = {
    job: { text: "The imported description", role: "Coordinator" },
    warnings: ["Review the imported text."],
  };
  t.mock.method(globalThis, "fetch", async () => Response.json(result));
  assert.deepEqual(
    await requestAPI("import-job", { url: "https://example.com" }),
    result,
  );
});
