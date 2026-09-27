import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const requireModule = createRequire(import.meta.url);
const id = "12345678-1234-1234-1234-123456789abc";
const canaries = [
  "accessibility-email-canary@example.com",
  "accessibility-token-canary-9182",
  "accessibility-input-secret-7712",
  "accessibility-dom-text-secret-6631",
  "accessibility-id-secret-5520",
];
const secret = canaries.join(" ");
function load(file, mocks = {}, globals = {}) {
  const context = {
    exports: {},
    URL,
    Headers,
    ...globals,
    require: (name) => (name in mocks ? mocks[name] : requireModule(name)),
  };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(new URL("../src/" + file, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    context,
  );
  return context.exports;
}
function fixture(state = "COMPLETE") {
  return {
    scan: { id, status: "COMPLETED", completedAt: null, raw: secret },
    assessment: {
      state,
      coverage:
        state === "NOT_ASSESSED"
          ? null
          : {
              version: 1,
              state,
              scope: "MAIN_DOCUMENT",
              engine: {
                name: "axe-core",
                version: "4.13.0",
                rulesetVersion: 1,
                profileId: "main-document-v1",
              },
              mainDocumentEvaluated: state !== "UNAVAILABLE",
              excludedFrameCount: 0,
              durationMs: 10,
              configuredRuleCount: 19,
              reasons:
                state === "COMPLETE"
                  ? []
                  : [
                      state === "PARTIAL"
                        ? "REFERENCE_UNAVAILABLE"
                        : "ENGINE_TIMEOUT",
                    ],
              error: secret,
            },
      limitations: [],
      metadata: secret,
    },
    summary: {
      findingCount: 0,
      countsBySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
      highestSeverity: null,
    },
    findings: [],
    html: secret,
    selector: secret,
    debug: secret,
  };
}
function setup() {
  let token = "server-token-canary",
    response = fixture(),
    status = 200,
    failure,
    memberships = [{ organization: { id: "server-org" } }];
  const calls = [];
  const { ApiError } = load("lib/api/api-error.ts");
  // Ensure route and real helpers share the same ApiError class.
  const serverWithError = load(
    "lib/api/server-api-client.ts",
    { "server-only": {}, "./api-error": { ApiError } },
    {
      process: { env: { API_URL: "https://internal.test/api/v1" } },
      fetch: async (url, options) => {
        calls.push({ url, options });
        if (failure) throw failure;
        return {
          ok: status === 200,
          status,
          json: async () =>
            status !== 200
              ? { message: secret }
              : url.endsWith("/auth/me")
                ? { memberships }
                : response,
        };
      },
    },
  );
  const auth = load("lib/api/authenticated-api.ts", {
    "server-only": {},
    "next/headers": {
      cookies: async () => ({
        get: (name) => {
          assert.equal(name, "reactpulse_access");
          return token ? { value: token } : undefined;
        },
      }),
    },
    "@/features/auth/auth-cookie": { AUTH_COOKIE_NAME: "reactpulse_access" },
    "./api-error": { ApiError },
    "./server-api-client": serverWithError,
  });
  const projection = load("lib/api/accessibility-report.ts");
  const { GET } = load("app/api/accessibility/route.ts", {
    "next/server": {
      NextResponse: {
        json: (body, options = {}) => ({
          body,
          status: options.status ?? 200,
          headers: options.headers,
        }),
      },
    },
    "@/lib/api/accessibility-report": projection,
    "@/lib/api/authenticated-api": auth,
    "@/lib/api/api-error": { ApiError },
    "@/features/organizations/get-active-organization": load(
      "features/organizations/get-active-organization.ts",
    ),
  });
  return {
    calls,
    get: (query = "?scanId=" + id) =>
      GET(new Request("https://app.test/api/accessibility" + query)),
    token: (v) => {
      token = v;
    },
    response: (v) => {
      response = v;
    },
    status: (v) => {
      status = v;
    },
    failure: (v) => {
      failure = v;
    },
    memberships: (v) => {
      memberships = v;
    },
  };
}
function noSecrets(result) {
  for (const s of [...canaries, "server-token-canary", "internal.test"])
    assert(!JSON.stringify(result).includes(s));
}
test("real cookie/auth helpers keep JWT server-side and resolve organization with no-store", async () => {
  const h = setup();
  h.token(null);
  assert.equal((await h.get()).status, 401);
  assert.equal(h.calls.length, 0);
  h.token("server-token-canary");
  const r = await h.get("?scanId=" + id + "&organizationId=attacker");
  assert.equal(r.status, 200);
  noSecrets(r);
  assert.equal(r.headers["Cache-Control"], "no-store");
  assert.equal(
    h.calls.at(-1).url,
    `https://internal.test/api/v1/organizations/server-org/scans/${id}/accessibility`,
  );
  for (const c of h.calls) {
    assert.equal(
      c.options.headers.get("Authorization"),
      "Bearer server-token-canary",
    );
    assert.equal(c.options.headers.get("Cookie"), null);
    assert.equal(c.options.cache, "no-store");
  }
  h.memberships([]);
  assert.equal((await h.get()).status, 403);
});
test("preserves all four assessment states with zero findings and strips canaries", async () => {
  const h = setup();
  for (const state of ["COMPLETE", "PARTIAL", "UNAVAILABLE", "NOT_ASSESSED"]) {
    h.response(fixture(state));
    const r = await h.get();
    assert.equal(r.status, 200);
    assert.equal(r.body.assessment.state, state);
    assert.equal(r.body.summary.findingCount, 0);
    noSecrets(r);
  }
});
test("invalid scan IDs fail before upstream and errors never expose bodies", async () => {
  const h = setup();
  for (const q of [
    "",
    "?scanId=",
    "?scanId=../secret",
    "?scanId=" + id + "&scanId=" + id,
  ])
    assert.equal((await h.get(q)).status, 400);
  assert.equal(h.calls.length, 0);
  for (const status of [401, 403, 404, 500, 503]) {
    h.status(status);
    const r = await h.get();
    assert.equal(r.status, status < 500 ? status : 502);
    noSecrets(r);
  }
  h.status(200);
  h.failure(new Error(secret));
  assert.equal((await h.get()).status, 502);
});
test("rejects malformed, mismatched and inconsistent upstream payloads", async () => {
  const h = setup();
  const mismatch = fixture();
  mismatch.scan.id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const inconsistent = fixture();
  inconsistent.summary.findingCount = 1;
  const invalid = fixture();
  invalid.assessment.coverage.reasons = [secret];
  for (const response of [{ raw: secret }, mismatch, inconsistent, invalid]) {
    h.response(response);
    const r = await h.get();
    assert.equal(r.status, 502);
    noSecrets(r);
  }
});
test("valid findings retain safe structural evidence while arbitrary finding fields are stripped", async () => {
  const h = setup(),
    report = fixture();
  report.findings = [
    {
      category: "ACCESSIBILITY",
      ruleId: "accessibility.axe-core.label",
      severity: "HIGH",
      confidence: "MEDIUM",
      status: "OPEN",
      title: secret,
      description: secret,
      recommendation: secret,
      evidence: {
        version: 1,
        mappingVersion: 1,
        engine: "axe-core",
        engineVersion: "4.13.0",
        rulesetVersion: 1,
        profileId: "main-document-v1",
        ruleId: "label",
        ruleVersion: 1,
        outcome: "VIOLATION",
        engineImpact: "SERIOUS",
        occurrenceCount: 1,
        countPrecision: "EXACT",
        samplesTruncated: false,
        wcagTags: ["wcag2a"],
        wcagCriteria: ["1.3.1"],
        sampledReferences: [
          {
            ordinal: 0,
            tag: "input",
            role: "textbox",
            path: [{ tag: "main", index: 0, id: secret }],
            html: secret,
          },
        ],
        raw: secret,
      },
    },
  ];
  report.summary = {
    findingCount: 1,
    countsBySeverity: { CRITICAL: 0, HIGH: 1, MEDIUM: 0, LOW: 0, INFO: 0 },
    highestSeverity: "HIGH",
  };
  h.response(report);
  const r = await h.get();
  assert.equal(r.status, 200);
  assert.equal(r.body.findings.length, 1);
  noSecrets(r);
  report.findings[0].evidence.sampledReferences[0].tag = secret;
  assert.equal((await h.get()).status, 502);
});
