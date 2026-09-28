const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  projectPublicFinding: project,
  projectFindingListQuery: query,
} = require("../dist");
const metadata = {
  id: "00000000-0000-4000-8000-000000000001",
  scanId: "00000000-0000-4000-8000-000000000002",
  status: "IGNORED",
  firstDetectedAt: "2026-01-01T00:00:00.000Z",
  lastDetectedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const fixtures = [
  {
    category: "SECURITY",
    ruleId: "security.csp.missing",
    severity: "LOW",
    confidence: "MEDIUM",
    evidence: {
      version: 1,
      ruleVersion: 1,
      outcome: "POSTURE",
      reason: "ENFORCED_CSP_ABSENT",
      source: "csp",
      subject: { kind: "MAIN_DOCUMENT" },
    },
  },
  {
    category: "ACCESSIBILITY",
    ruleId: "accessibility.axe-core.label",
    severity: "HIGH",
    confidence: "MEDIUM",
    evidence: {
      version: 1,
      ruleVersion: 1,
      mappingVersion: 1,
      engine: "axe-core",
      engineVersion: "4.13.0",
      rulesetVersion: 1,
      profileId: "main-document-v1",
      ruleId: "label",
      outcome: "VIOLATION",
      engineImpact: "SERIOUS",
      occurrenceCount: 1,
      countPrecision: "EXACT",
      samplesTruncated: false,
      sampledReferences: [],
      wcagTags: [],
      wcagCriteria: [],
    },
  },
  {
    category: "PERFORMANCE",
    ruleId: "performance.lcp.above-good-threshold",
    severity: "MEDIUM",
    confidence: "HIGH",
    evidence: {
      version: 1,
      ruleVersion: 1,
      context: "SYNTHETIC",
      metric: "lcp",
      measuredValue: 3000,
      unit: "ms",
      threshold: 2500,
      comparison: "GT",
    },
  },
  {
    category: "NETWORK",
    ruleId: "network.request-failure-observed",
    severity: "INFO",
    confidence: "HIGH",
    evidence: {
      version: 1,
      ruleVersion: 1,
      context: "SYNTHETIC",
      failureKind: "REQUEST_FAILED",
      observedFailureCount: 2,
    },
  },
];
const canaries = [
  "api-findings-email-canary@example.com",
  "api-findings-token-canary-9182",
  "api-findings-query-secret-7712",
  "api-findings-dom-secret-6631",
  "api-findings-header-secret-5520",
];
for (const f of fixtures)
  test(`${f.category} public projection validates category evidence and removes secrets`, () => {
    const safe = project({ ...metadata, ...f });
    assert.ok(safe);
    assert.equal(safe.category, f.category);
    assert.equal(safe.ruleVersion, 1);
    assert.equal(safe.status, "IGNORED");
    assert.ok(!("fingerprint" in safe));
    assert.ok(!("fingerprintIdentity" in safe));
    const dirty = {
      ...metadata,
      ...f,
      title: canaries[0],
      description: canaries[1],
      recommendation: canaries[2],
      sourceFile: canaries[3],
      fingerprint: canaries[4],
      evidence: { ...f.evidence, raw: canaries },
    };
    assert.deepEqual(project(dirty), safe);
    for (const c of canaries)
      assert.ok(!JSON.stringify(project(dirty)).includes(c));
    for (const other of fixtures.filter((v) => v.category !== f.category))
      assert.equal(
        project({ ...metadata, ...f, evidence: other.evidence }),
        null,
      );
    for (const patch of [
      { status: "BAD" },
      { id: canaries[0] },
      { createdAt: "invalid" },
      { evidence: { ...f.evidence, ruleVersion: 2 } },
    ])
      assert.equal(project({ ...metadata, ...f, ...patch }), null);
  });
test("query uses enums, approved identities, bounded pagination and no free-text", () => {
  assert.deepEqual(query({}), { limit: 50 });
  assert.deepEqual(
    query({ limit: "100", category: "RESOURCE", status: "REGRESSION" }),
    { limit: 100, category: "RESOURCE", status: "REGRESSION" },
  );
  for (const q of [
    { limit: 101 },
    { limit: 0 },
    { limit: NaN },
    { limit: ["1"] },
    { ruleId: canaries[0] },
    { category: "unknown" },
    { search: "text" },
    { cursor: "x".repeat(257) },
  ])
    assert.equal(query(q), null);
});
