const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  projectNetworkFindingEvidence: project,
  projectDeterministicFindingCandidate: candidate,
} = require("../dist");
const evidence = {
  version: 1,
  context: "SYNTHETIC",
  failureKind: "REQUEST_FAILED",
  observedFailureCount: 2,
};
const identity = {
  category: "NETWORK",
  ruleId: "network.request-failure-observed",
  ruleVersion: 1,
};
const input = {
  ...identity,
  severity: "INFO",
  confidence: "HIGH",
  affectedResource: { kind: "MAIN_DOCUMENT" },
  fingerprintIdentity: { ...identity, subject: { kind: "MAIN_DOCUMENT" } },
  evidence,
};
test("network evidence requires a positive safe integer and fixed vocabulary", () => {
  assert.deepEqual(project(evidence), evidence);
  for (const count of [
    null,
    undefined,
    0,
    -1,
    NaN,
    Infinity,
    -Infinity,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.equal(project({ ...evidence, observedFailureCount: count }), null);
  for (const patch of [
    { version: 2 },
    { context: "FIELD" },
    { failureKind: "HTTP_ERROR" },
  ])
    assert.equal(project({ ...evidence, ...patch }), null);
  assert.equal(
    project({
      get version() {
        throw Error("private");
      },
    }),
    null,
  );
});
test("network candidate enforces policy, category evidence and safe identity", () => {
  assert.ok(candidate(input));
  for (const patch of [
    { severity: "LOW" },
    { confidence: "LOW" },
    { ruleVersion: 2 },
    { ruleId: "network.unknown" },
    { category: "PERFORMANCE" },
    { evidence: { version: 1, metric: "lcp" } },
    { affectedResource: { kind: "COOKIE" } },
  ])
    assert.equal(candidate({ ...input, ...patch }), null);
});
test("network projection excludes canaries, raw data and caller prose", () => {
  const canaries = [
    "network-email-canary@example.com",
    "network-token-canary-9182",
    "network-input-secret-7712",
    "network-query-secret-6631",
    "network-fragment-secret-5520",
  ];
  const dirty = {
    ...input,
    title: canaries[0],
    recommendation: canaries[1],
    url: canaries[3],
    evidence: {
      ...evidence,
      samples: canaries,
      headers: canaries,
      body: canaries,
    },
  };
  assert.deepEqual(candidate(dirty), candidate(input));
  for (const c of canaries)
    assert.ok(!JSON.stringify(candidate(dirty)).includes(c));
});
