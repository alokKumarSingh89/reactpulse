// Run with node --test apps/web/test/security-boundaries.test.mjs; no new framework.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as contracts from '@reactpulse/contracts';
const requireModule = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const id = "12345678-1234-1234-1234-123456789abc";
const canaries = [
  "authorization-secret-canary-9f31",
  "cookie-secret-canary-8ab2",
  "query-secret-canary-74ce",
  "userinfo-secret-canary-61fa",
  "fragment-secret-canary-44bd",
  "nonce-secret-canary-27aa",
  "console-secret-canary-13ef",
  "filesystem-secret-canary-02dc",
];
const secret = canaries.join(" ");
function load(file, mocks = {}) {
  const context = {
    exports: {},
    URL,
    require: (name) => (name in mocks ? mocks[name] : requireModule(name)),
  };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    context,
  );
  return context.exports;
}
function fixture(state, findings = []) {
  return {
    scan: { id, status: "COMPLETED", completedAt: null, raw: secret },
    assessment: {
      state,
      coverage:
        state === "NOT_ASSESSED"
          ? null
          : { version: 1, rulesetVersion: 1, state, reasons: [] },
      limitations: ["OBSERVATIONS_NOT_PERSISTED"],
      raw: secret,
    },
    observations: {
      state: "UNAVAILABLE",
      reason: "OBSERVATIONS_NOT_PERSISTED",
      raw: secret,
    },
    findings,
    raw: secret,
  };
}
function finding() {
  return {
    category: "SECURITY",
    ruleId: "security.csp.missing",
    severity: "MEDIUM",
    confidence: "HIGH",
    status: "OPEN",
    title: secret,
    description: secret,
    recommendation: secret,
    evidence: {
      version: 1,
      ruleVersion: 1,
      outcome: "POSTURE",
      reason: "ENFORCED_CSP_ABSENT",
      source: "csp",
      subject: { kind: "MAIN_DOCUMENT", raw: secret },
      raw: secret,
    },
    affectedResource: secret,
  };
}
function noSecrets(value) {
  for (const canary of canaries)
    assert(!JSON.stringify(value).includes(canary));
}
test("transport projection and rendered report contain no raw legacy fields or hostile prose", () => {
  const { SecurityReportView } = load("features/security/security-report.tsx", {
    "@/components/ui/badge": {
      Badge: ({ children }) => React.createElement("span", null, children),
    },
  });
  for (const state of ["COMPLETE", "PARTIAL", "UNAVAILABLE", "NOT_ASSESSED"]) {
    for (const rows of state === "COMPLETE" || state === "PARTIAL"
      ? [[], [finding()]]
      : [[]]) {
      const report = contracts.projectSecurityReport(fixture(state, rows));
      assert(report);
      assert.equal(report.assessment.state, state);
      noSecrets(report);
      const html = renderToStaticMarkup(
        React.createElement(SecurityReportView, { report }),
      );
      noSecrets(html);
      assert.equal(
        html.includes("No reportable conditions detected"),
        state === "COMPLETE" && !rows.length,
      );
      assert(
        !/Your application is secure|No vulnerabilities|Protected from clickjacking/.test(
          html,
        ),
      );
      if (rows.length) {
        assert(html.includes("<details"));
        assert(html.includes("Enforced CSP not observed"));
      }
    }
  }
  assert.equal(contracts.projectSecurityReport({ raw: secret }), null);
  const malformed = fixture("COMPLETE", [finding()]);
  malformed.findings[0].evidence.subject = {
    kind: "COOKIE",
    cookieOrdinal: -1,
  };
  assert.equal(contracts.projectSecurityReport(malformed), null);
});
test("BFF retains states, server organization and bounded errors", async () => {
  class ApiError extends Error {
    constructor(status) {
      super(secret);
      this.status = status;
    }
  }
  let response = fixture("COMPLETE", [finding()]),
    failure,
    calls = [];
  const { GET } = load("app/api/security/route.ts", {
    "next/server": {
      NextResponse: {
        json: (body, options = {}) => ({ body, status: options.status ?? 200 }),
      },
    },
    "@/lib/api/api-error": { ApiError },
    "@/features/organizations/get-active-organization": {
      getActiveOrganization: (u) => u.memberships[0],
    },
    "@/lib/api/authenticated-api": {
      authenticatedApiRequest: async (p) => {
        calls.push(p);
        if (failure) throw failure;
        return p === "/auth/me"
          ? { memberships: [{ organization: { id: "server-org" } }] }
          : response;
      },
    },
  });
  const get = (query) => GET({ url: "https://app.test/api/security" + query });
  for (const query of ["", "?scanId=", "?scanId=../secret"])
    assert.equal((await get(query)).status, 400);
  assert.equal(calls.length, 0);
  for (const state of ["COMPLETE", "PARTIAL", "UNAVAILABLE", "NOT_ASSESSED"]) {
    response = fixture(state);
    const result = await get("?scanId=" + id + "&organizationId=attacker");
    assert.equal(result.status, 200);
    assert.equal(result.body.assessment.state, state);
    noSecrets(result);
  }
  assert.equal(calls.at(-1), `/organizations/server-org/scans/${id}/security`);
  for (const status of [400, 401, 403, 404, 500]) {
    failure = new ApiError(status);
    const result = await get("?scanId=" + id);
    assert.equal(result.status, status === 500 ? 502 : status);
    noSecrets(result);
  }
  failure = new Error(secret);
  assert.equal((await get("?scanId=" + id)).status, 502);
  failure = null;
  response = { raw: secret };
  assert.equal((await get("?scanId=" + id)).status, 502);
});
