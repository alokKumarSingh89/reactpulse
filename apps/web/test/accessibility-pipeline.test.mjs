// Cross-layer closure test: real transformation/persistence code, mocked IO.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as contracts from "@reactpulse/contracts";
const requireModule = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const cache = new Map();
const id = "12345678-1234-1234-1234-123456789abc";
const canaries = [
  "accessibility-email-canary@example.com",
  "accessibility-token-canary-9182",
  "accessibility-input-secret-7712",
  "accessibility-dom-text-secret-6631",
  "accessibility-id-secret-5520",
];
const secret = canaries.join(" ");
const hostileUrl =
  "https://user:accessibility-token-canary-9182@example.com/account/accessibility-id-secret-5520?token=accessibility-input-secret-7712#accessibility-dom-text-secret-6631";
function load(relative, mocks = {}) {
  const file = path.resolve(root, relative);
  if (!Object.keys(mocks).length && cache.has(file)) return cache.get(file);
  const context = {
    exports: {},
    URL,
    require(name) {
      if (name in mocks) return mocks[name];
      if (name === "@nestjs/common")
        return { Injectable: () => (target) => target };
      if (name.includes("database.service"))
        return { DatabaseService: class {} };
      if (name.startsWith("."))
        return load(
          path.relative(root, path.resolve(path.dirname(file), name + ".ts")),
        );
      if (name.startsWith("@/"))
        return load("apps/web/src/" + name.slice(2) + ".ts");
      return requireModule(name);
    },
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        experimentalDecorators: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    context,
    { filename: file },
  );
  if (!Object.keys(mocks).length) cache.set(file, context.exports);
  return context.exports;
}
const { projectAccessibilityObservation: project } = load(
  "apps/scanner/src/accessibility/accessibility-projector.ts",
);
const { mapAccessibilityFindings: map } = load(
  "apps/scanner/src/accessibility/accessibility-finding-mapper.ts",
);
const { AccessibilityFindingService: Service } = load(
  "apps/scanner/src/accessibility/accessibility-finding.service.ts",
);
const { buildAccessibilityReport: report } = load(
  "apps/api/src/scans/accessibility-report.ts",
);
const webProjector = load("apps/web/src/lib/api/accessibility-report.ts");
const { AccessibilityReportView: View } = load(
  "apps/web/src/features/accessibility/accessibility-report.tsx",
  {
    "@/lib/api/accessibility-report": webProjector,
    "@/components/ui/badge": {
      Badge: ({ children }) => React.createElement("span", null, children),
    },
  },
);
function noSecrets(value) {
  for (const c of canaries) assert(!JSON.stringify(value).includes(c));
}
function raw(ids = ["label", "image-alt", "button-name"], frames = 0) {
  const result = {
    engine: "axe-core",
    engineVersion: "4.13.0",
    rulesetVersion: 1,
    scope: "MAIN_DOCUMENT",
    state: "SUCCEEDED",
    durationMs: 10,
    excludedFrameCount: frames,
    raw: {
      violations: ids.map((id) => ({
        id,
        impact: "serious",
        tags: ["wcag2a", "wcag131"],
        help: secret,
        description: secret,
        nodes: [
          {
            html: secret,
            textContent: secret,
            value: secret,
            target: [secret],
            id: secret,
            className: secret,
            "aria-label": secret,
            href: hostileUrl,
            failureSummary: secret,
            error: { message: secret },
            metadata: secret,
          },
        ],
      })),
      passes: [],
      incomplete: [],
      inapplicable: contracts.ACCESSIBILITY_RULE_IDS.filter(
        (id) => !ids.includes(id),
      ).map((id) => ({ id, nodes: [] })),
      url: hostileUrl,
    },
  };
  const structures = ids.map((ruleId) => ({
    group: "violations",
    ruleId,
    nodeIndex: 0,
    tag: "input",
    role: "textbox",
    path: [
      { tag: "main", index: 0 },
      { tag: "input", index: 1 },
    ],
  }));
  return project(result, structures);
}
function db() {
  let rows = [
    { scanId: id, category: "SECURITY", fingerprint: "S1" },
    { scanId: "other", category: "ACCESSIBILITY", fingerprint: "other" },
  ];
  let evidence = [
    { scanId: id, type: "PERFORMANCE", sequence: 0, data: { safe: true } },
    { scanId: id, type: "NETWORK_REQUEST", sequence: 0, data: { safe: true } },
    {
      scanId: id,
      type: "DOCUMENT_RESPONSE",
      sequence: 1,
      data: { kind: "PASSIVE_SECURITY_ASSESSMENT" },
    },
  ];
  let fail;
  const writes = [];
  const owned = (r) =>
    r.scanId === id && r.type === "DOCUMENT_RESPONSE" && r.sequence === 2;
  const checkpoint = (stage) => {
    if (fail === stage) throw new Error(secret);
  };
  const service = new Service({
    client: {
      $transaction: async (fn) => {
        const savedRows = structuredClone(rows),
          savedEvidence = structuredClone(evidence);
        try {
          await fn({
            scanEvidence: {
              upsert: async ({ create, update, where }) => {
                checkpoint("marker");
                writes.push({ create, update, where });
                evidence = evidence.filter((r) => !owned(r));
                evidence.push(create);
              },
              deleteMany: async () => {
                evidence = evidence.filter((r) => !owned(r));
              },
            },
            finding: {
              findMany: async ({ where }) => rows.filter(r => r.scanId === where.scanId && r.category === where.category),
              updateMany: async ({ where, data }) => {
                checkpoint("update");
                writes.push(data);
                rows = rows.map(r => r.scanId === where.scanId && r.category === where.category && r.fingerprint === where.fingerprint ? { ...r, ...data } : r);
              },
              deleteMany: async ({ where }) => {
                checkpoint("delete");
                assert.equal(where.category, "ACCESSIBILITY");
                assert.equal(where.scanId, id);
                rows = rows.filter(
                  (r) =>
                    r.scanId !== where.scanId || r.category !== where.category || where.fingerprint.notIn.includes(r.fingerprint),
                );
              },
              createMany: async ({ data }) => {
                checkpoint("create");
                writes.push(data);
                rows.push(...data);
              },
            },
          });
          checkpoint("commit");
        } catch (e) {
          rows = savedRows;
          evidence = savedEvidence;
          throw e;
        }
      },
    },
  });
  return {
    service,
    writes,
    fail: (v) => {
      fail = v;
    },
    state: () => ({ rows, evidence }),
    api: () =>
      report({
        id,
        status: "COMPLETED",
        completedAt: null,
        evidence: evidence.filter(owned),
        findings: rows.filter(
          (r) => r.scanId === id && r.category === "ACCESSIBILITY",
        ),
      }),
  };
}
async function bff(upstream) {
  const { GET } = load("apps/web/src/app/api/accessibility/route.ts", {
    "next/server": {
      NextResponse: {
        json: (body, options = {}) => ({ body, status: options.status ?? 200 }),
      },
    },
    "@/lib/api/accessibility-report": webProjector,
    "@/lib/api/authenticated-api": {
      authenticatedApiRequest: async (p) =>
        p === "/auth/me"
          ? { memberships: [{ organization: { id: "org" } }] }
          : upstream,
    },
  });
  return GET({ url: "https://app.test/api/accessibility?scanId=" + id });
}
test("hostile raw results remain private through actual persistence, API, BFF and rendered UI", async () => {
  const h = db(),
    assessment = raw(),
    candidates = map(assessment);
  assert.equal(assessment.state, "COMPLETE");
  assert.equal(candidates.length, 3);
  noSecrets(assessment);
  noSecrets(candidates);
  await h.service.replaceForScan(id, candidates, assessment);
  noSecrets(h.writes);
  const api = h.api();
  assert.equal(api.assessment.state, "COMPLETE");
  assert.equal(api.findings.length, 3);
  noSecrets(api);
  const response = await bff(api);
  assert.equal(response.status, 200);
  noSecrets(response);
  const html = renderToStaticMarkup(
    React.createElement(View, { report: response.body }),
  );
  noSecrets(html);
  assert(html.includes("Structural references"));
  // Persisted corruption is still stripped at the downstream trust boundaries.
  h.state().evidence.find((r) => r.sequence === 2).data.raw = secret;
  h.state().rows.find((r) => r.ruleId).evidence.html = secret;
  noSecrets((await bff(h.api())).body);
});
test("full pipeline preserves zero, partial, unavailable and legacy states independently of counts", async () => {
  const h = db();
  assert.equal(h.api().assessment.state, "NOT_ASSESSED");
  for (const [ids, frames] of [
    [["label", "image-alt", "button-name"], 0],
    [["label", "button-name"], 0],
    [[], 0],
    [["label"], 2],
    [[], 2],
  ]) {
    const assessment = raw(ids, frames),
      candidates = map(assessment);
    await h.service.replaceForScan(id, candidates, assessment);
    const snapshot = JSON.stringify(h.state());
    await h.service.replaceForScan(id, [...candidates].reverse(), assessment);
    assert.equal(JSON.stringify(h.state()), snapshot);
    const response = await bff(h.api());
    assert.equal(response.status, 200);
    assert.equal(
      response.body.assessment.state,
      frames ? "PARTIAL" : "COMPLETE",
    );
    assert.equal(response.body.findings.length, ids.length);
    assert.equal(h.state().evidence.filter((r) => r.sequence === 2).length, 1);
    assert.equal(
      h.state().rows.filter((r) => r.category === "SECURITY").length,
      1,
    );
    assert.equal(h.state().evidence.filter((r) => r.sequence !== 2).length, 3);
  }
  for (const reason of [
    "ENGINE_TIMEOUT",
    "PAGE_CONTEXT_UNAVAILABLE",
    "ENGINE_UNAVAILABLE",
  ]) {
    const assessment = project({
      engine: "axe-core",
      engineVersion: "4.13.0",
      rulesetVersion: 1,
      scope: "MAIN_DOCUMENT",
      state: "UNAVAILABLE",
      reason,
      durationMs: 10,
      excludedFrameCount: 0,
      error: secret,
    });
    await h.service.replaceForScan(id, map(assessment), assessment);
    const response = await bff(h.api());
    assert.equal(response.body.assessment.state, "UNAVAILABLE");
    noSecrets(response);
  }
  await h.service.replaceForScan(id, [], null);
  assert.equal(h.api().assessment.state, "NOT_ASSESSED");
});
for (const stage of ["marker", "delete", "create", "update", "commit"])
  test(
    "cross-layer reconciliation rolls back " + stage + " failure",
    async () => {
      const h = db(),
        initial = raw();
      await h.service.replaceForScan(id, map(initial), initial);
      const saved = JSON.stringify(h.state());
      h.fail(stage);
      const next = raw(stage === "create" ? ["document-title"] : ["label"], 2);
      await assert.rejects(h.service.replaceForScan(id, map(next), next));
      assert.equal(JSON.stringify(h.state()), saved);
      assert.equal(h.api().assessment.state, "COMPLETE");
      assert.equal(h.api().findings.length, 3);
    },
  );
test("scanner and public catalog/policy stay aligned for every supported rule", () => {
  const candidates = map(raw(contracts.ACCESSIBILITY_RULE_IDS));
  assert.equal(candidates.length, contracts.ACCESSIBILITY_RULE_IDS.length);
  for (const row of candidates) {
    const publicRow = contracts.projectAccessibilityReportFinding(row);
    assert(publicRow);
    for (const key of [
      "title",
      "description",
      "recommendation",
      "severity",
      "confidence",
    ])
      assert.equal(row[key], publicRow[key]);
  }
});
