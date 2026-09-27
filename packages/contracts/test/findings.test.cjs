// Run after contracts build: node --test packages/contracts/test/findings.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c = require("../dist");
const canaries = [
  "findings-email-canary@example.com",
  "findings-token-canary-9182",
  "findings-input-secret-7712",
  "findings-dom-secret-6631",
  "findings-url-secret-5520",
];
const secret = canaries.join(" ");
function security(cookie = false) {
  const ruleId = cookie
    ? "security.cookie.secure-missing"
    : "security.csp.missing";
  const [reason, source] = c.SECURITY_FINDING_PRESENTATION[ruleId];
  const subject = cookie
    ? { kind: "COOKIE", documentResponseOrdinal: 0, cookieOrdinal: 1 }
    : { kind: "MAIN_DOCUMENT" };
  return {
    category: "SECURITY",
    ruleId,
    ruleVersion: 1,
    severity: "LOW",
    confidence: "MEDIUM",
    title: secret,
    description: secret,
    recommendation: secret,
    affectedResource: subject,
    fingerprintIdentity: {
      category: "SECURITY",
      ruleId,
      ruleVersion: 1,
      subject,
    },
    evidence: {
      version: 1,
      ruleVersion: 1,
      outcome: "POSTURE",
      reason,
      source,
      subject,
    },
  };
}
function accessibility() {
  const ruleId = "accessibility.axe-core.label";
  return {
    category: "ACCESSIBILITY",
    ruleId,
    ruleVersion: 1,
    severity: "HIGH",
    confidence: "MEDIUM",
    title: secret,
    description: secret,
    recommendation: secret,
    affectedResource: { kind: "MAIN_DOCUMENT" },
    fingerprintIdentity: {
      category: "ACCESSIBILITY",
      ruleId,
      ruleVersion: 1,
      subject: { kind: "MAIN_DOCUMENT" },
      engine: "axe-core",
      engineRuleId: "label",
      rulesetVersion: 1,
      mappingVersion: 1,
      profileId: "main-document-v1",
    },
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
      sampledReferences: [
        {
          ordinal: 0,
          tag: "input",
          role: "textbox",
          path: [{ tag: "main", index: 0 }],
        },
      ],
      wcagTags: ["wcag2a"],
      wcagCriteria: ["1.3.1"],
    },
  };
}
function noSecrets(value) {
  for (const canary of canaries)
    assert(!JSON.stringify(value).includes(canary));
}
test("shared vocabularies match actual Prisma enums without a runtime database dependency", () => {
  const schema = fs.readFileSync(
    path.resolve(__dirname, "../../database/prisma/schema.prisma"),
    "utf8",
  );
  for (const [name, values] of [
    ["FindingCategory", c.FINDING_CATEGORIES],
    ["FindingSeverity", c.FINDING_SEVERITIES],
    ["FindingConfidence", c.FINDING_CONFIDENCES],
    ["FindingStatus", c.FINDING_STATUSES],
  ]) {
    const body = schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`))[1];
    assert.deepEqual(body.trim().split(/\s+/), values);
  }
});
test("rule identities are allowlisted and require bounded integer versions", () => {
  for (const candidate of [security(), accessibility()]) {
    const identity = c.projectDeterministicRuleIdentity(candidate);
    assert(identity);
    assert.equal(identity.category, candidate.category);
    for (const ruleVersion of [
      undefined,
      0,
      -1,
      1.1,
      NaN,
      Infinity,
      65536,
      "1",
    ])
      assert.equal(
        c.projectDeterministicRuleIdentity({ ...candidate, ruleVersion }),
        null,
      );
    assert.equal(
      c.projectDeterministicRuleIdentity({ ...candidate, ruleVersion: 65535 })
        .ruleVersion,
      65535,
    );
    for (const ruleId of [
      "",
      "x".repeat(10000),
      secret,
      "https://user:password@example.com/?token=secret",
      "performance.future-rule",
    ])
      assert.equal(
        c.projectDeterministicRuleIdentity({ ...candidate, ruleId }),
        null,
      );
  }
  assert.equal(
    c.projectDeterministicRuleIdentity({ ...security(), category: "RESOURCE" }),
    null,
  );
});
test("metadata is bounded catalog content, not caller-owned prose or lifecycle", () => {
  for (const input of [security(), accessibility()]) {
    const metadata = c.projectDeterministicRuleDefinition({
      ...input,
      status: "IGNORED",
      createdAt: secret,
    });
    assert(metadata);
    noSecrets(metadata);
    for (const key of ["title", "description", "recommendation"])
      assert(metadata[key].length <= c.FINDING_CATALOG_LIMITS[key]);
    assert(!("status" in metadata));
    assert(!("severity" in metadata));
    assert(!("createdAt" in metadata));
    assert.equal(
      c.projectDeterministicRuleDefinition({ ...input, ruleVersion: 2 }),
      null,
    );
  }
});
test("category-specific evidence, severity and confidence are validated without flattening", () => {
  for (const input of [security(), security(true), accessibility()]) {
    const candidate = c.projectDeterministicFindingCandidate(input);
    assert(candidate);
    assert.equal(candidate.category, input.category);
    noSecrets(candidate);
    assert.deepEqual(
      c.projectDeterministicFindingCandidate(candidate),
      candidate,
    );
    for (const severity of ["SERIOUS", 87])
      assert.equal(
        c.projectDeterministicFindingCandidate({ ...input, severity }),
        null,
      );
    for (const confidence of [0.92, "87%"])
      assert.equal(
        c.projectDeterministicFindingCandidate({ ...input, confidence }),
        null,
      );
  }
  assert.equal(
    c.projectDeterministicFindingCandidate({
      ...security(),
      evidence: accessibility().evidence,
    }),
    null,
  );
  assert.equal(
    c.projectDeterministicFindingCandidate({
      ...accessibility(),
      evidence: security().evidence,
    }),
    null,
  );
});
test("fingerprint identities retain only safe normalized identity and do not depend on scans or counts", () => {
  for (const input of [security(), security(true), accessibility()]) {
    const identity = input.fingerprintIdentity;
    const augmented = {
      ...identity,
      scanId: secret,
      html: secret,
      raw: secret,
      headers: secret,
      evidence: input.evidence,
      count: 123,
      createdAt: secret,
    };
    Object.assign(augmented.subject, {
      value: secret,
      url: secret,
      selector: secret,
    });
    const projected = c.projectFindingFingerprintIdentity(augmented);
    assert(projected);
    noSecrets(projected);
    assert.deepEqual(
      c.projectFindingFingerprintIdentity({
        ...augmented,
        count: 999,
        scanId: "different",
      }),
      projected,
    );
    assert.equal(
      c.projectFindingFingerprintIdentity({
        ...identity,
        subject: { kind: "URL", url: secret },
      }),
      null,
    );
    assert.equal(
      c.projectFindingFingerprintIdentity({ ...identity, ruleId: secret }),
      null,
    );
  }
  const cookie = security(true).fingerprintIdentity;
  for (const cookieOrdinal of [-1, 100, NaN, secret])
    assert.equal(
      c.projectFindingFingerprintIdentity({
        ...cookie,
        subject: { ...cookie.subject, cookieOrdinal },
      }),
      null,
    );
  const a = accessibility().fingerprintIdentity;
  assert.equal(
    c.projectFindingFingerprintIdentity({ ...a, engineRuleId: "image-alt" }),
    null,
  );
});
test("candidate projection excludes secret-bearing extras at every nested boundary", () => {
  for (const input of [security(), accessibility()]) {
    Object.assign(input, {
      raw: secret,
      status: "IGNORED",
      scanId: secret,
      timestamp: secret,
    });
    Object.assign(input.evidence, {
      html: secret,
      error: secret,
      metadata: secret,
    });
    if (input.category === "ACCESSIBILITY") {
      Object.assign(input.evidence.sampledReferences[0], {
        id: secret,
        ariaLabel: secret,
      });
      Object.assign(input.evidence.sampledReferences[0].path[0], {
        class: secret,
      });
    }
    const output = c.projectDeterministicFindingCandidate(input);
    assert(output);
    noSecrets(output);
    for (const key of ["raw", "status", "scanId", "timestamp", "fingerprint"])
      assert(!(key in output));
  }
});
test("semantic rule version, evidence serialization version and category identity must agree", () => {
  const a = accessibility();
  assert.equal(
    c.projectDeterministicFindingCandidate({ ...a, ruleVersion: 2 }),
    null,
  );
  assert.equal(
    c.projectDeterministicFindingCandidate({
      ...a,
      evidence: { ...a.evidence, version: 2 },
    }),
    null,
  );
  assert.equal(
    c.projectDeterministicFindingCandidate({
      ...a,
      fingerprintIdentity: { ...a.fingerprintIdentity, mappingVersion: 2 },
    }),
    null,
  );
  assert.equal(
    c.projectDeterministicFindingCandidate({
      ...security(true),
      affectedResource: { kind: "MAIN_DOCUMENT" },
    }),
    null,
  );
  for (const input of [
    null,
    [],
    {},
    {
      get category() {
        throw Error(secret);
      },
    },
  ]) {
    assert.equal(c.projectDeterministicFindingCandidate(input), null);
    assert.equal(c.projectFindingFingerprintIdentity(input), null);
  }
});
