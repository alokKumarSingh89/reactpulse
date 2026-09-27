// Compile-only tests. No raw engine/database dependency enters these contracts.
import type {
  DeterministicFindingCandidate,
  DeterministicRuleDefinition,
  FindingFingerprintIdentity,
  FindingEvidenceByCategory,
} from "../src/findings";
declare const security: Extract<
  DeterministicFindingCandidate,
  { category: "SECURITY" }
>;
declare const accessibility: Extract<
  DeterministicFindingCandidate,
  { category: "ACCESSIBILITY" }
>;
const securityEvidence: FindingEvidenceByCategory["SECURITY"] =
  security.evidence;
const accessibilityEvidence: FindingEvidenceByCategory["ACCESSIBILITY"] =
  accessibility.evidence;
// @ts-expect-error Category discriminator must stay paired with its evidence.
const wrongSecurity: DeterministicFindingCandidate = {
  ...security,
  evidence: accessibility.evidence,
};
// @ts-expect-error Category discriminator must stay paired with its evidence.
const wrongAccessibility: DeterministicFindingCandidate = {
  ...accessibility,
  evidence: security.evidence,
};
const urlIdentity: FindingFingerprintIdentity = {
  ...security.fingerprintIdentity,
  // @ts-expect-error Raw URLs are not safe resource identities.
  subject: { kind: "URL", url: "https://secret.test" },
};
const rawIdentity: FindingFingerprintIdentity = {
  ...security.fingerprintIdentity,
  // @ts-expect-error Fingerprints do not consume arbitrary evidence.
  evidence: { html: "secret" },
};
const scanIdentity: FindingFingerprintIdentity = {
  ...security.fingerprintIdentity,
  // @ts-expect-error Scan IDs are not logical fingerprint inputs.
  scanId: "scan",
};
declare const definition: DeterministicRuleDefinition;
// @ts-expect-error Lifecycle is not a deterministic rule property.
definition.status;
// @ts-expect-error Lifecycle is not a deterministic candidate property.
security.status;
const statusDefinition: DeterministicRuleDefinition = {
  ...definition,
  // @ts-expect-error Mutable lifecycle status is not static metadata.
  status: "OPEN",
};
// @ts-expect-error Semantic rule version is required.
const unversioned: DeterministicRuleDefinition = {
  category: "SECURITY",
  ruleId: "security.csp.missing",
  title: "",
  description: "",
  recommendation: "",
};
void [
  securityEvidence,
  accessibilityEvidence,
  wrongSecurity,
  wrongAccessibility,
  urlIdentity,
  rawIdentity,
  scanIdentity,
  statusDefinition,
  unversioned,
];

declare const performance: Extract<DeterministicFindingCandidate, { category: "PERFORMANCE" }>;
const performanceEvidence: FindingEvidenceByCategory["PERFORMANCE"] = performance.evidence;
// @ts-expect-error Performance cannot carry Security evidence.
const invalidPerformance: DeterministicFindingCandidate = { ...performance, evidence: security.evidence };
// @ts-expect-error Security cannot carry Performance evidence.
const invalidSecurity: DeterministicFindingCandidate = { ...security, evidence: performance.evidence };
// @ts-expect-error Accessibility cannot carry Performance evidence.
const invalidAccessibility: DeterministicFindingCandidate = { ...accessibility, evidence: performance.evidence };
void [performanceEvidence, invalidPerformance, invalidSecurity, invalidAccessibility];
