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

declare const network: Extract<DeterministicFindingCandidate, { category: "NETWORK" }>;
const networkEvidence: FindingEvidenceByCategory["NETWORK"] = network.evidence;
// @ts-expect-error Network cannot carry performance evidence.
const invalidNetwork: DeterministicFindingCandidate = { ...network, evidence: performance.evidence };
// @ts-expect-error Security cannot carry network evidence.
const networkInSecurity: DeterministicFindingCandidate = { ...security, evidence: network.evidence };
void [networkEvidence, invalidNetwork, networkInSecurity];

import type { PublicFinding } from '../src/findings-api';
declare const publicSecurity: Extract<PublicFinding, { category: 'SECURITY' }>;
declare const publicNetwork: Extract<PublicFinding, { category: 'NETWORK' }>;
// @ts-expect-error Public category and evidence must remain paired.
const wrongPublicFinding: PublicFinding = { ...publicSecurity, evidence: publicNetwork.evidence };
// @ts-expect-error Internal fingerprint identity is not public.
publicSecurity.fingerprintIdentity;
void wrongPublicFinding;
