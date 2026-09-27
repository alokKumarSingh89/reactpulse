import type { SecurityAssessmentCoverage } from "./security";

export const ACCESSIBILITY_CONTRACT_VERSION = 1 as const;
export const ACCESSIBILITY_LIMITS = {
  rules: 256,
  occurrences: 20_000,
  samplesPerRule: 20,
  pathSegments: 32,
  frames: 1_000,
  durationMs: 120_000,
  serializedBytes: 262_144,
} as const;

/** Same execution states as security, plus absence of an assessment. COMPLETE
 * describes the declared automated scope, never accessibility/compliance. */
export type AccessibilityAssessmentState =
  SecurityAssessmentCoverage["state"] | "NOT_ASSESSED";

export const ACCESSIBILITY_REASONS = [
  "ENGINE_UNAVAILABLE",
  "ENGINE_TIMEOUT",
  "PAGE_CONTEXT_UNAVAILABLE",
  "NAVIGATION_CHANGED",
  "RESULT_LIMIT_EXCEEDED",
  "NODE_LIMIT_REACHED",
  "FRAME_COVERAGE_PARTIAL",
  "UNSUPPORTED_RULE",
  "REFERENCE_UNAVAILABLE",
  "NEEDS_REVIEW",
  "INVALID_ENGINE_RESULT",
  "ANALYSIS_NOT_RUN",
] as const;
export type AccessibilityReason = (typeof ACCESSIBILITY_REASONS)[number];

/** Identifier vocabulary only: this does not enable rules or map findings.
 * Extend through a reviewed contract/catalog change after pinning the engine.
 * Never accept engine-provided arbitrary IDs, prose, links or tag strings. */
export const ACCESSIBILITY_RULE_IDS = [
  "image-alt",
  "input-image-alt",
  "label",
  "button-name",
  "link-name",
  "select-name",
  "color-contrast",
  "aria-valid-attr",
  "aria-valid-attr-value",
  "aria-required-attr",
  "aria-allowed-attr",
  "aria-roles",
  "document-title",
  "html-has-lang",
  "html-lang-valid",
  "heading-order",
  "landmark-one-main",
  "region",
  "tabindex",
] as const;
export type AccessibilityRuleId = (typeof ACCESSIBILITY_RULE_IDS)[number];
export const ACCESSIBILITY_WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
] as const;
export const ACCESSIBILITY_WCAG_CRITERIA = [
  "1.1.1",
  "1.3.1",
  "1.3.2",
  "1.4.3",
  "1.4.11",
  "2.1.1",
  "2.1.2",
  "2.4.2",
  "2.4.3",
  "2.4.4",
  "2.4.6",
  "2.4.7",
  "2.4.11",
  "2.5.3",
  "2.5.8",
  "3.1.1",
  "3.3.2",
  "4.1.2",
] as const;
const tags = [
  "html",
  "body",
  "main",
  "nav",
  "header",
  "footer",
  "section",
  "article",
  "aside",
  "div",
  "span",
  "p",
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "form",
  "img",
  "svg",
  "table",
  "tr",
  "td",
  "th",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "iframe",
  "OTHER",
] as const;
const roles = [
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "listbox",
  "option",
  "heading",
  "img",
  "navigation",
  "main",
  "region",
  "dialog",
  "tab",
  "tabpanel",
  "table",
  "row",
  "cell",
  "list",
  "listitem",
  "presentation",
  "none",
  "UNKNOWN",
] as const;
const impacts = [
  "MINOR",
  "MODERATE",
  "SERIOUS",
  "CRITICAL",
  "UNKNOWN",
] as const;
const outcomes = ["VIOLATION", "NEEDS_REVIEW", "PASS", "INAPPLICABLE"] as const;

export interface AccessibilityElementReference {
  /** Scan-local ordinal, not a hash of page content. */
  ordinal: number;
  tag: (typeof tags)[number];
  role: (typeof roles)[number];
  /** Approximate snapshot path only. No IDs, classes, attributes or selectors.
   * Null means unavailable; indexes are zero-based element-sibling indexes. */
  path: readonly { tag: (typeof tags)[number]; index: number }[] | null;
}
export interface AccessibilityRuleObservation {
  ruleId: AccessibilityRuleId;
  ruleVersion: number;
  outcome: (typeof outcomes)[number];
  /** Native engine impact; severity/confidence mapping belongs to later rules. */
  engineImpact: (typeof impacts)[number];
  occurrenceCount: number;
  countPrecision: "EXACT" | "LOWER_BOUND";
  sampledReferences: readonly AccessibilityElementReference[];
  samplesTruncated: boolean;
  /** Catalog-approved rule associations, never a compliance assertion. */
  wcagTags: readonly (typeof ACCESSIBILITY_WCAG_TAGS)[number][];
  wcagCriteria: readonly (typeof ACCESSIBILITY_WCAG_CRITERIA)[number][];
}
export interface AccessibilityAssessment {
  version: typeof ACCESSIBILITY_CONTRACT_VERSION;
  state: AccessibilityAssessmentState;
  /** Application-owned configuration. Version must come from the installed
   * package, not window.axe or page data. No engine is selected/installed here. */
  engine: {
    name: "axe-core";
    version: string;
    rulesetVersion: number;
    profileId: "main-document-v1";
  } | null;
  scope: "MAIN_DOCUMENT";
  mainDocumentEvaluated: boolean;
  excludedFrameCount: number;
  reasons: readonly AccessibilityReason[];
  durationMs: number | null;
  configuredRuleCount: number;
  results: readonly AccessibilityRuleObservation[];
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function member<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}
function integer(value: unknown, max: number, min = 0): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}
function vocabulary<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T[] | null {
  if (
    !Array.isArray(value) ||
    value.length > allowed.length ||
    !value.every((v) => member(allowed, v)) ||
    new Set(value).size !== value.length
  )
    return null;
  return allowed.filter((v) => value.includes(v));
}
function reference(value: unknown): AccessibilityElementReference | null {
  const r = record(value);
  if (
    !integer(r.ordinal, ACCESSIBILITY_LIMITS.occurrences - 1) ||
    !member(tags, r.tag) ||
    !member(roles, r.role)
  )
    return null;
  let path: AccessibilityElementReference["path"] = null;
  if (r.path !== null) {
    if (
      !Array.isArray(r.path) ||
      !r.path.length ||
      r.path.length > ACCESSIBILITY_LIMITS.pathSegments
    )
      return null;
    const segments: { tag: (typeof tags)[number]; index: number }[] = [];
    for (const value of r.path) {
      const s = record(value);
      if (
        !member(tags, s.tag) ||
        !integer(s.index, ACCESSIBILITY_LIMITS.occurrences - 1)
      )
        return null;
      segments.push({ tag: s.tag, index: s.index });
    }
    path = segments;
  }
  return { ordinal: r.ordinal, tag: r.tag, role: r.role, path };
}
function observation(value: unknown): AccessibilityRuleObservation | null {
  const r = record(value);
  const wcagTags = vocabulary(r.wcagTags, ACCESSIBILITY_WCAG_TAGS);
  const wcagCriteria = vocabulary(r.wcagCriteria, ACCESSIBILITY_WCAG_CRITERIA);
  if (
    !member(ACCESSIBILITY_RULE_IDS, r.ruleId) ||
    !integer(r.ruleVersion, 65535, 1) ||
    !member(outcomes, r.outcome) ||
    !member(impacts, r.engineImpact) ||
    !integer(r.occurrenceCount, ACCESSIBILITY_LIMITS.occurrences) ||
    !member(["EXACT", "LOWER_BOUND"] as const, r.countPrecision) ||
    typeof r.samplesTruncated !== "boolean" ||
    !wcagTags ||
    !wcagCriteria ||
    !Array.isArray(r.sampledReferences) ||
    r.sampledReferences.length > ACCESSIBILITY_LIMITS.samplesPerRule ||
    r.sampledReferences.length > r.occurrenceCount
  )
    return null;
  const samples: AccessibilityElementReference[] = [];
  for (const value of r.sampledReferences) {
    const sample = reference(value);
    if (!sample || samples.some((s) => s.ordinal === sample.ordinal))
      return null;
    samples.push(sample);
  }
  if (
    (r.outcome === "VIOLATION" || r.outcome === "NEEDS_REVIEW") &&
    r.occurrenceCount === 0
  )
    return null;
  if (
    r.outcome === "INAPPLICABLE" &&
    (r.occurrenceCount !== 0 || samples.length)
  )
    return null;
  return {
    ruleId: r.ruleId,
    ruleVersion: r.ruleVersion,
    outcome: r.outcome,
    engineImpact: r.engineImpact,
    occurrenceCount: r.occurrenceCount,
    countPrecision: r.countPrecision,
    samplesTruncated: r.samplesTruncated,
    sampledReferences: samples,
    wcagTags,
    wcagCriteria,
  };
}

/** Manual projection matches security contracts: strip extra fields, fail closed
 * on invalid known fields. Strings are enum tokens except application-owned
 * numeric engine versions (max 20 ASCII chars). No page-derived free text, URLs,
 * prose, raw errors, hashes of DOM content, or arbitrary JSON are representable.
 * This validates normalized facts, not correctness of an engine or rule mapping.
 * Collection must enforce its own work/time limits before calling this boundary.
 */
export function projectAccessibilityAssessment(
  value: unknown,
): AccessibilityAssessment | null {
  try {
    return project(value);
  } catch {
    return null;
  }
}
function project(value: unknown): AccessibilityAssessment | null {
  const a = record(value);
  const reasons = vocabulary(a.reasons, ACCESSIBILITY_REASONS);
  if (
    a.version !== ACCESSIBILITY_CONTRACT_VERSION ||
    !member(
      ["COMPLETE", "PARTIAL", "UNAVAILABLE", "NOT_ASSESSED"] as const,
      a.state,
    ) ||
    a.scope !== "MAIN_DOCUMENT" ||
    typeof a.mainDocumentEvaluated !== "boolean" ||
    !integer(a.excludedFrameCount, ACCESSIBILITY_LIMITS.frames) ||
    !reasons ||
    !integer(a.configuredRuleCount, ACCESSIBILITY_LIMITS.rules) ||
    !(
      a.durationMs === null ||
      (typeof a.durationMs === "number" &&
        Number.isFinite(a.durationMs) &&
        a.durationMs >= 0 &&
        a.durationMs <= ACCESSIBILITY_LIMITS.durationMs)
    ) ||
    !Array.isArray(a.results) ||
    a.results.length > ACCESSIBILITY_LIMITS.rules ||
    a.results.length > a.configuredRuleCount
  )
    return null;
  let engine: AccessibilityAssessment["engine"] = null;
  if (a.engine !== null) {
    const e = record(a.engine);
    if (
      e.name !== "axe-core" ||
      typeof e.version !== "string" ||
      e.version.length > 20 ||
      !/^[0-9]{1,6}\.[0-9]{1,6}\.[0-9]{1,6}$/.test(e.version) ||
      !integer(e.rulesetVersion, 65535, 1) ||
      e.profileId !== "main-document-v1"
    )
      return null;
    engine = {
      name: "axe-core",
      version: e.version,
      rulesetVersion: e.rulesetVersion,
      profileId: "main-document-v1",
    };
  }
  const results: AccessibilityRuleObservation[] = [];
  for (const value of a.results) {
    const result = observation(value);
    if (!result || results.some((r) => r.ruleId === result.ruleId)) return null;
    results.push(result);
  }
  const usable = a.state === "COMPLETE" || a.state === "PARTIAL";
  if (
    usable &&
    (!engine ||
      !a.mainDocumentEvaluated ||
      a.durationMs === null ||
      !a.configuredRuleCount)
  )
    return null;
  if (!usable && (results.length || a.mainDocumentEvaluated)) return null;
  if (
    a.state === "NOT_ASSESSED" &&
    (engine !== null ||
      a.durationMs !== null ||
      a.configuredRuleCount !== 0 ||
      a.excludedFrameCount !== 0 ||
      reasons.length !== 1 ||
      reasons[0] !== "ANALYSIS_NOT_RUN")
  )
    return null;
  if (a.state !== "NOT_ASSESSED" && reasons.includes("ANALYSIS_NOT_RUN"))
    return null;
  if (
    a.state === "COMPLETE" &&
    (reasons.length ||
      a.excludedFrameCount ||
      results.length !== a.configuredRuleCount)
  )
    return null;
  if ((a.state === "PARTIAL" || a.state === "UNAVAILABLE") && !reasons.length)
    return null;
  if (a.excludedFrameCount && !reasons.includes("FRAME_COVERAGE_PARTIAL"))
    return null;
  if (
    results.some((r) => r.outcome === "NEEDS_REVIEW") &&
    !reasons.includes("NEEDS_REVIEW")
  )
    return null;
  if (
    results.some(
      (r) => r.samplesTruncated || r.countPrecision === "LOWER_BOUND",
    ) &&
    !reasons.includes("RESULT_LIMIT_EXCEEDED")
  )
    return null;
  if (
    results.some(
      (r) =>
        r.sampledReferences.length < r.occurrenceCount && !r.samplesTruncated,
    ) &&
    !reasons.includes("REFERENCE_UNAVAILABLE")
  )
    return null;
  if (
    results.some((r) => r.sampledReferences.some((s) => s.path === null)) &&
    !reasons.includes("REFERENCE_UNAVAILABLE")
  )
    return null;
  const result: AccessibilityAssessment = {
    version: ACCESSIBILITY_CONTRACT_VERSION,
    state: a.state,
    engine,
    scope: "MAIN_DOCUMENT",
    mainDocumentEvaluated: a.mainDocumentEvaluated,
    excludedFrameCount: a.excludedFrameCount,
    reasons,
    durationMs: a.durationMs,
    configuredRuleCount: a.configuredRuleCount,
    results,
  };
  // Every projected string is ASCII; serialized character count equals UTF-8 bytes.
  return JSON.stringify(result).length <= ACCESSIBILITY_LIMITS.serializedBytes
    ? result
    : null;
}
