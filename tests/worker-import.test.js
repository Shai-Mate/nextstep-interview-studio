import test from "node:test";
import assert from "node:assert/strict";
import {
  parseWorkerJobUrl,
  fetchWorkerJobPage,
  importWorkerJob,
} from "../server/worker-import.js";

const jobHtml = `<html><head><title>Customer support role</title><script type="application/ld+json">${JSON.stringify(
  {
    "@graph": [
      {
        "@type": "JobPosting",
        title: "Support advisor",
        hiringOrganization: { name: "Kind Co" },
        description:
          "<p>Help our customers resolve account questions with clear communication. Work with the service team to maintain accurate records and improve customer experiences.</p>",
      },
    ],
  },
)}</script></head><body>Cookie settings</body></html>`;
const htmlResponse = (body = jobHtml) =>
  new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

test("worker importer accepts established job platforms and normalizes fragment/trailing dot", () => {
  assert.equal(
    parseWorkerJobUrl(" https://ca.indeed.com./m/viewjob?jk=123#details ").href,
    "https://ca.indeed.com/m/viewjob?jk=123",
  );
  assert.equal(
    parseWorkerJobUrl("https://boards.greenhouse.io/company/jobs/12").hostname,
    "boards.greenhouse.io",
  );
  assert.equal(
    parseWorkerJobUrl("https://company.wd1.myworkdayjobs.com/role").hostname,
    "company.wd1.myworkdayjobs.com",
  );
});

test("worker importer denies credentials, local hosts, IP spellings and unsupported hosts before any fetch", async () => {
  for (const value of [
    "http://ca.indeed.com/job",
    "https://localhost/job",
    "https://127.0.0.1/job",
    "https://2130706433/job",
    "https://0x7f000001/job",
    "https://0177.0.0.1/job",
    "https://[::ffff:127.0.0.1]/job",
    "https://[::1]/job",
    "https://10.0.0.1/job",
    "https://metadata.internal/job",
    "https://user:password@indeed.com/job",
    "https://indeed.com:8443/job",
    "file:///etc/passwd",
  ]) {
    let fetched = false;
    await assert.rejects(
      fetchWorkerJobPage(value, {
        fetcher: async () => {
          fetched = true;
          return htmlResponse();
        },
      }),
      (error) => error.code === "UNSAFE_URL",
      value,
    );
    assert.equal(fetched, false, value);
  }
  for (const value of [
    "https://evilindeed.com/job",
    "https://indeed.com.evil.org/job",
    "https://example.org/job",
  ]) {
    await assert.rejects(
      fetchWorkerJobPage(value),
      (error) => error.code === "UNSUPPORTED_JOB_HOST",
      value,
    );
  }
});

test("worker importer validates every redirect and does not fetch a private or unsupported destination", async () => {
  for (const target of [
    "https://127.0.0.1/secret",
    "https://metadata.internal/secret",
    "https://public.evil.org/job",
  ]) {
    const visited = [];
    await assert.rejects(
      fetchWorkerJobPage("https://jobs.lever.co/company/role", {
        fetcher: async (url, options) => {
          visited.push(url);
          assert.equal(options.redirect, "manual");
          assert.equal(options.headers.Authorization, undefined);
          return new Response(null, {
            status: 302,
            headers: { location: target },
          });
        },
      }),
      (error) => ["UNSAFE_URL", "UNSUPPORTED_JOB_HOST"].includes(error.code),
    );
    assert.equal(visited.length, 1);
  }
});

test("worker importer follows a relative redirect and imports structured JobPosting", async () => {
  const visited = [];
  const result = await importWorkerJob(
    { url: "https://jobs.lever.co/company/start" },
    {
      fetcher: async (url) => {
        visited.push(url);
        return visited.length === 1
          ? new Response(null, {
              status: 302,
              headers: { location: "/company/role#apply" },
            })
          : htmlResponse();
      },
    },
  );
  assert.deepEqual(visited, [
    "https://jobs.lever.co/company/start",
    "https://jobs.lever.co/company/role",
  ]);
  assert.equal(result.job.role, "Support advisor");
  assert.equal(result.job.company, "Kind Co");
  assert.equal(result.job.url, "https://jobs.lever.co/company/role");
  assert.equal(result.job.source, "job-posting");
  assert.doesNotMatch(result.job.text, /Cookie settings|<p>/);
});

test("worker importer extracts plain public job text on a supported hiring platform", async () => {
  const result = await importWorkerJob(
    { url: "https://jobs.ashbyhq.com/company/role" },
    {
      fetcher: async () =>
        htmlResponse(
          "<title>Warehouse associate</title><body><nav>Cookie help</nav><main><p>Receive customer deliveries, maintain accurate stock records, prepare orders for dispatch and follow safe working practices with the warehouse team each day.</p></main></body>",
        ),
    },
  );
  assert.equal(result.job.source, "page");
  assert.equal(result.job.company, "");
  assert.match(result.job.text, /accurate stock records/);
  assert.doesNotMatch(result.job.text, /Cookie help/);
  assert.ok(result.warnings.some((warning) => warning.includes("structured")));
});

test("worker importer reports blocked Indeed responses without treating them as disconnected service", async () => {
  for (const status of [401, 403, 429]) {
    await assert.rejects(
      importWorkerJob(
        { url: "https://ca.indeed.com/m/viewjob?jk=123" },
        {
          fetcher: async () => new Response("blocked", { status }),
        },
      ),
      (error) =>
        error.code === "SITE_BLOCKED" &&
        /Indeed/.test(error.message) &&
        error.status === 422,
    );
  }
});

test("worker importer rejects challenge HTML returned with HTTP 200", async () => {
  for (const body of [
    "<title>Just a moment...</title><body>Enable JavaScript and cookies to continue. This website uses a security service to protect itself from online attacks.</body>",
    "<title>Security check | Indeed</title><body>Please verify you are human to access the page. We require a browser to continue to the job listing.</body>",
    "<title>Job page</title><body>Complete the security check to access this page. Please follow the instructions to complete the process and continue.</body>",
  ]) {
    await assert.rejects(
      importWorkerJob(
        { url: "https://ca.indeed.com/m/viewjob?jk=123" },
        { fetcher: async () => htmlResponse(body) },
      ),
      (error) => error.code === "SITE_BLOCKED",
    );
  }
});

test("worker importer stops at sign-in redirects without fetching the login page", async () => {
  let calls = 0;
  await assert.rejects(
    fetchWorkerJobPage("https://www.linkedin.com/jobs/view/123", {
      fetcher: async () => {
        calls++;
        return new Response(null, {
          status: 302,
          headers: { location: "/authwall?return=job" },
        });
      },
    }),
    (error) => error.code === "SITE_BLOCKED",
  );
  assert.equal(calls, 1);
});

test("worker importer distinguishes removed job ads and rejects non-text responses", async () => {
  for (const status of [404, 410])
    await assert.rejects(
      fetchWorkerJobPage("https://jobs.lever.co/company/role", {
        fetcher: async () => new Response(null, { status }),
      }),
      (error) => error.code === "JOB_NOT_FOUND",
    );
  await assert.rejects(
    fetchWorkerJobPage("https://jobs.lever.co/company/role", {
      fetcher: async () =>
        new Response("data", {
          headers: { "content-type": "application/pdf" },
        }),
    }),
    (error) => error.code === "UNSUPPORTED_PAGE",
  );
});

test("worker importer limits redirect loops", async () => {
  let calls = 0;
  await assert.rejects(
    fetchWorkerJobPage("https://jobs.lever.co/company/role", {
      fetcher: async () => {
        calls++;
        return new Response(null, {
          status: 302,
          headers: { location: "/again" },
        });
      },
    }),
    (error) => error.code === "REDIRECT_LIMIT",
  );
  assert.equal(calls, 4);
});

test("worker importer bounds both declared and streamed response sizes", async () => {
  for (const response of [
    new Response("small", {
      headers: { "content-type": "text/html", "content-length": "999" },
    }),
    htmlResponse("x".repeat(101)),
  ]) {
    await assert.rejects(
      fetchWorkerJobPage("https://jobs.lever.co/company/role", {
        fetcher: async () => response,
        maxBytes: 100,
      }),
      (error) => error.code === "PAGE_TOO_LARGE",
    );
  }
});

test("worker importer timeout covers a stalled request and aborts it", async () => {
  let signal;
  await assert.rejects(
    fetchWorkerJobPage("https://jobs.lever.co/company/role", {
      fetcher: async (_url, options) => {
        signal = options.signal;
        return new Promise(() => {});
      },
      timeoutMs: 10,
    }),
    (error) => error.code === "IMPORT_TIMEOUT" && error.status === 504,
  );
  assert.equal(signal.aborted, true);
});

test("worker importer timeout also covers a stalled response body", async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      start() {},
      cancel() {
        cancelled = true;
      },
    }),
    { headers: { "content-type": "text/html" } },
  );
  await assert.rejects(
    fetchWorkerJobPage("https://jobs.lever.co/company/role", {
      fetcher: async () => response,
      timeoutMs: 10,
    }),
    (error) => error.code === "IMPORT_TIMEOUT",
  );
  assert.equal(cancelled, true);
});

test("worker importer does not leak unexpected transport errors", async () => {
  await assert.rejects(
    fetchWorkerJobPage("https://jobs.lever.co/company/role", {
      fetcher: async () => {
        throw new Error("sensitive network diagnostic");
      },
    }),
    (error) =>
      error.code === "SITE_UNAVAILABLE" && !error.message.includes("sensitive"),
  );
});
