const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  projectPerformanceFindingEvidence: project,
  projectDeterministicFindingCandidate: candidate,
  projectDeterministicRuleDefinition: definition,
} = require("../dist");
const rules = [
  ["performance.lcp.above-good-threshold", "lcp", "ms", 2500, 2501],
  [
    "performance.synthetic-cls.above-good-threshold",
    "synthetic_cls",
    "score",
    0.1,
    0.101,
  ],
];
for (const [ruleId, metric, unit, threshold, measuredValue] of rules) {
  const evidence = {
    version: 1,
    context: "SYNTHETIC",
    comparison: "GT",
    metric,
    unit,
    threshold,
    measuredValue,
  };
  const input = {
    category: "PERFORMANCE",
    ruleId,
    ruleVersion: 1,
    severity: "MEDIUM",
    confidence: "HIGH",
    affectedResource: { kind: "MAIN_DOCUMENT" },
    fingerprintIdentity: {
      category: "PERFORMANCE",
      ruleId,
      ruleVersion: 1,
      metric,
      subject: { kind: "MAIN_DOCUMENT" },
    },
    evidence,
  };
  test(`${metric}: strict evidence and policy projection`, () => {
    assert.deepEqual(project(evidence), evidence);
    for (const value of [
      null,
      undefined,
      -1,
      NaN,
      Infinity,
      -Infinity,
      threshold,
    ])
      assert.equal(project({ ...evidence, measuredValue: value }), null);
    for (const patch of [
      { version: 2 },
      { unit: "seconds" },
      { comparison: "GTE" },
      { threshold: 99 },
      { context: "FIELD" },
    ])
      assert.equal(project({ ...evidence, ...patch }), null);
    assert.ok(candidate(input));
    for (const patch of [
      { severity: "HIGH" },
      { confidence: "LOW" },
      { ruleVersion: 2 },
      { category: "SECURITY" },
      { evidence: { version: 1, outcome: "POSTURE" } },
    ])
      assert.equal(candidate({ ...input, ...patch }), null);
    assert.equal(
      candidate({
        ...input,
        fingerprintIdentity: { ...input.fingerprintIdentity, metric: "ttfb" },
      }),
      null,
    );
    assert.equal(
      candidate({ ...input, affectedResource: { kind: "COOKIE" } }),
      null,
    );
    assert.equal(candidate(input).title, definition(input).title);
  });
  test(`${metric}: strips secrets and caller prose`, () => {
    const canaries = [
      "performance-email-canary@example.com",
      "performance-token-canary-9182",
      "performance-input-secret-7712",
      "performance-dom-secret-6631",
      "performance-url-secret-5520",
    ];
    const dirty = {
      ...input,
      title: canaries[0],
      recommendation: canaries[1],
      scanId: canaries[2],
      evidence: { ...evidence, url: canaries[4], dom: canaries[3] },
    };
    assert.deepEqual(candidate(dirty), candidate(input));
    for (const c of canaries)
      assert.ok(!JSON.stringify(candidate(dirty)).includes(c));
    assert.equal(
      project({
        get version() {
          throw new Error("secret");
        },
      }),
      null,
    );
  });
}
