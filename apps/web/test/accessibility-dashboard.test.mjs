import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
          jsx: ts.JsxEmit.ReactJSX,
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

const projection = load("lib/api/accessibility-report.ts");
const components = load("features/accessibility/accessibility-report.tsx", {
  "@/lib/api/accessibility-report": projection,
  "@/components/ui/badge": {
    Badge: ({ children }) => React.createElement("span", null, children),
  },
});
function finding() {
  return {
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
      occurrenceCount: 23,
      countPrecision: "EXACT",
      samplesTruncated: true,
      wcagTags: ["wcag2a"],
      wcagCriteria: ["1.3.1"],
      sampledReferences: [
        {
          ordinal: 0,
          tag: "input",
          role: "textbox",
          path: [
            { tag: "main", index: 0 },
            { tag: "input", index: 2 },
          ],
          html: secret,
        },
      ],
      raw: secret,
    },
  };
}
function render(report) {
  return renderToStaticMarkup(
    React.createElement(components.AccessibilityReportView, { report }),
  );
}
test("assessment states and exact zero-finding language do not imply compliance", () => {
  for (const state of ["COMPLETE", "PARTIAL", "UNAVAILABLE", "NOT_ASSESSED"]) {
    const html = render(fixture(state));
    assert.equal(
      html.includes(
        "No reportable conditions were detected by the automated checks in this scan.",
      ),
      state === "COMPLETE",
    );
    assert(
      html.includes(
        "Automated checks cannot detect every accessibility issue.",
      ),
    );
    if (state === "PARTIAL") assert(html.includes("limited coverage"));
    if (state === "UNAVAILABLE")
      assert(html.includes("could not produce a usable assessment"));
    if (state === "NOT_ASSESSED")
      assert(html.includes("This scan was not evaluated for accessibility."));
    assert(
      !/WCAG compliant|Fully accessible|Accessibility passed|complianceScore|accessibility score/i.test(
        html,
      ),
    );
    for (const c of canaries) assert(!html.includes(c));
  }
});
test("complete and partial findings render bounded developer details and structural samples", () => {
  for (const state of ["COMPLETE", "PARTIAL"]) {
    const report = fixture(state);
    report.assessment.coverage.reasons = ["RESULT_LIMIT_EXCEEDED"];
    report.assessment.state = "PARTIAL";
    report.assessment.coverage.state = "PARTIAL";
    report.findings = [finding()];
    report.summary = {
      findingCount: 1,
      countsBySeverity: { CRITICAL: 0, HIGH: 1, MEDIUM: 0, LOW: 0, INFO: 0 },
      highestSeverity: "HIGH",
    };
    if (state === "COMPLETE") {
      report.assessment.state = "COMPLETE";
      report.assessment.coverage.state = "COMPLETE";
      report.assessment.coverage.reasons = [];
    }
    const html = render(report);
    for (const text of [
      "HIGH",
      "SERIOUS",
      "23 occurrences",
      "1 sample",
      "WCAG 2 A",
      "1.3.1",
      "main[0] → input[2]",
      "Recommendation",
      "Associate a descriptive label",
      "<details",
      "<summary",
      "focus-visible:outline",
    ])
      assert(html.includes(text), text);
    for (const c of canaries) assert(!html.includes(c));
    assert(!html.includes("failureSummary"));
  }
});
test("loading and retry states are labeled and bounded", () => {
  assert(
    renderToStaticMarkup(
      React.createElement(components.AccessibilitySkeleton),
    ).includes("Loading accessibility report"),
  );
  const html = renderToStaticMarkup(
    React.createElement(components.AccessibilityReportError, {
      retry: () => {},
    }),
  );
  assert(html.includes('role="alert"'));
  assert(html.includes("Try again"));
});
test("scan query selection uses the established top-level route and latest completed convention", async () => {
  const scans = [
    {
      id: "running",
      status: "RUNNING",
      createdAt: new Date(0).toISOString(),
      environment: {
        id: "env",
        name: "Production",
        project: { id: "project", name: "Example" },
      },
    },
    {
      id,
      status: "COMPLETED",
      createdAt: new Date(0).toISOString(),
      environment: {
        id: "env",
        name: "Production",
        project: { id: "project", name: "Example" },
      },
    },
  ];
  const { default: Page } = load("app/(dashboard)/accessibility/page.tsx", {
    "next/link": {
      default: ({ children, ...props }) =>
        React.createElement("a", props, children),
    },
    "next/navigation": {
      redirect: () => {
        throw new Error("redirect");
      },
    },
    "@/features/auth/get-current-user": {
      getCurrentUser: async () => ({ memberships: [] }),
    },
    "@/features/organizations/get-active-organization": {
      getActiveOrganization: () => ({ organization: { id: "org" } }),
    },
    "@/features/scans/scan-api": { getOrganizationScans: async () => scans },
    "@/features/scans/run-scan-button": { RunScanButton: () => null },
    "@/features/accessibility/accessibility-report": {
      AccessibilityReport: ({ scanId }) =>
        React.createElement("div", null, "selected:" + scanId),
    },
  });
  for (const [query, selected] of [
    [{}, id],
    [{ scanId: "running" }, "running"],
  ]) {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve(query) }),
    );
    assert(html.includes('action="/accessibility"'));
    assert(html.includes("selected:" + selected));
  }
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ scanId: "unknown" }) }),
  );
  assert(html.includes("Scan unavailable"));
  assert(!html.includes("selected:"));
});
