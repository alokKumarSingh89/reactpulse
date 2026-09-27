import type { AccessibilityRuleId } from "./accessibility";

/** ReactPulse-owned prose. Engine help/messages and page values never enter it.
 * Associations with WCAG remain evidence metadata, not compliance claims. */
export const ACCESSIBILITY_REPORT_PRESENTATION = {
  "image-alt": [
    "Image alternative text needs attention",
    "An automated check detected an image without an appropriate text alternative.",
    "Provide a meaningful text alternative, or mark a purely decorative image appropriately.",
  ],
  "input-image-alt": [
    "Image input needs an accessible name",
    "An automated check detected an image input without an appropriate text alternative.",
    "Provide text describing the action performed by the image input.",
  ],
  label: [
    "Form control needs a label",
    "An automated check detected a form control without an associated accessible label.",
    "Associate a descriptive label with the control and verify it with assistive technology.",
  ],
  "button-name": [
    "Button needs an accessible name",
    "An automated check detected a button without an accessible name.",
    "Provide a name that describes the button action.",
  ],
  "link-name": [
    "Link needs an accessible name",
    "An automated check detected a link without an accessible name.",
    "Provide descriptive link text or an appropriate accessible name.",
  ],
  "select-name": [
    "Select control needs an accessible name",
    "An automated check detected a select control without an accessible name.",
    "Associate a descriptive label with the select control.",
  ],
  "color-contrast": [
    "Text contrast needs attention",
    "An automated check detected text contrast below the rule threshold.",
    "Review foreground and background colors and verify contrast in the rendered state.",
  ],
  "aria-valid-attr": [
    "ARIA attribute is not recognized",
    "An automated check detected an unrecognized ARIA attribute.",
    "Use supported ARIA attribute names and prefer native HTML semantics.",
  ],
  "aria-valid-attr-value": [
    "ARIA attribute value needs attention",
    "An automated check detected an invalid ARIA attribute value.",
    "Use a value supported by the attribute and verify referenced relationships.",
  ],
  "aria-required-attr": [
    "Required ARIA attribute is missing",
    "An automated check detected a role missing a required ARIA attribute.",
    "Provide the required states and properties for the role.",
  ],
  "aria-allowed-attr": [
    "ARIA attribute does not match its role",
    "An automated check detected an ARIA attribute unsupported by its role.",
    "Align ARIA attributes with the element role and prefer native semantics.",
  ],
  "aria-roles": [
    "ARIA role needs attention",
    "An automated check detected an invalid ARIA role.",
    "Use a recognized role appropriate to the element behavior.",
  ],
  "document-title": [
    "Document title needs attention",
    "An automated check detected a missing or empty document title.",
    "Provide a concise title identifying the page purpose.",
  ],
  "html-has-lang": [
    "Document language is missing",
    "An automated check detected a document without a declared language.",
    "Declare the primary language on the document root.",
  ],
  "html-lang-valid": [
    "Document language needs attention",
    "An automated check detected an invalid document language declaration.",
    "Use a valid language tag for the primary document language.",
  ],
  "heading-order": [
    "Heading hierarchy needs review",
    "An automated check detected a skipped heading level.",
    "Review heading levels so they express the document hierarchy.",
  ],
  "landmark-one-main": [
    "Main landmark needs attention",
    "An automated check detected a document without the expected main landmark structure.",
    "Provide a main landmark identifying the primary page content.",
  ],
  region: [
    "Content landmark coverage needs attention",
    "An automated check detected content outside recognized landmarks.",
    "Organize page content within appropriate semantic landmarks.",
  ],
  tabindex: [
    "Positive tab order needs review",
    "An automated check detected a positive tabindex value.",
    "Prefer natural document focus order and verify keyboard navigation.",
  ],
} as const satisfies Record<
  AccessibilityRuleId,
  readonly [string, string, string]
>;

import {
  projectAccessibilityAssessment,
  projectAccessibilityCoverage,
  type AccessibilityCoverage,
  type AccessibilityAssessmentState,
} from "./accessibility";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export const ACCESSIBILITY_REPORT_SEVERITIES = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
] as const;
export type AccessibilityReportSeverity =
  (typeof ACCESSIBILITY_REPORT_SEVERITIES)[number];
export function projectAccessibilityMarker(
  value: unknown,
): AccessibilityCoverage | null {
  try {
    const marker = record(value);
    if (marker.kind !== "ACCESSIBILITY_ASSESSMENT" || marker.version !== 1)
      return null;
    const safe = projectAccessibilityCoverage(marker.assessment);
    if (
      !safe ||
      safe.state === "NOT_ASSESSED" ||
      (safe.engine && safe.engine.rulesetVersion !== 1)
    )
      return null;
    return safe;
  } catch {
    return null;
  }
}
export function projectAccessibilityReportFinding(value: unknown) {
  try {
    const f = record(value),
      e = record(f.evidence);
    const safe = projectAccessibilityAssessment({
      version: 1,
      state: "PARTIAL",
      scope: "MAIN_DOCUMENT",
      mainDocumentEvaluated: true,
      engine: {
        name: e.engine,
        version: e.engineVersion,
        rulesetVersion: e.rulesetVersion,
        profileId: e.profileId,
      },
      excludedFrameCount: 0,
      reasons: ["REFERENCE_UNAVAILABLE", "RESULT_LIMIT_EXCEEDED"],
      durationMs: 0,
      configuredRuleCount: 1,
      results: [
        {
          ruleId: e.ruleId,
          ruleVersion: e.ruleVersion,
          outcome: e.outcome,
          engineImpact: e.engineImpact,
          occurrenceCount: e.occurrenceCount,
          countPrecision: e.countPrecision,
          samplesTruncated: e.samplesTruncated,
          sampledReferences: e.sampledReferences,
          wcagTags: e.wcagTags,
          wcagCriteria: e.wcagCriteria,
        },
      ],
    });
    const row = safe?.results[0];
    const statuses = [
      "OPEN",
      "ACKNOWLEDGED",
      "RESOLVED",
      "IGNORED",
      "REGRESSION",
    ] as const;
    const status = statuses.find((s) => s === f.status);
    if (
      !row ||
      !safe?.engine ||
      !status ||
      f.category !== "ACCESSIBILITY" ||
      f.ruleId !== `accessibility.axe-core.${row.ruleId}` ||
      e.version !== 1 ||
      e.mappingVersion !== 1 ||
      e.rulesetVersion !== 1 ||
      row.ruleVersion !== 1 ||
      row.outcome !== "VIOLATION"
    )
      return null;
    const policy = {
      CRITICAL: ["HIGH", "MEDIUM"],
      SERIOUS: ["HIGH", "MEDIUM"],
      MODERATE: ["MEDIUM", "MEDIUM"],
      MINOR: ["LOW", "MEDIUM"],
      UNKNOWN: ["INFO", "LOW"],
    } as const;
    const [severity, confidence] = policy[row.engineImpact];
    if (f.severity !== severity || f.confidence !== confidence) return null;
    const [title, description, recommendation] =
      ACCESSIBILITY_REPORT_PRESENTATION[row.ruleId];
    return {
      category: "ACCESSIBILITY" as const,
      ruleId: `accessibility.axe-core.${row.ruleId}` as const,
      severity,
      confidence,
      status,
      title,
      description,
      recommendation,
      affectedUrl: null,
      affectedResource: "main-document" as const,
      evidence: {
        version: 1 as const,
        mappingVersion: 1 as const,
        engine: safe.engine.name,
        engineVersion: safe.engine.version,
        rulesetVersion: safe.engine.rulesetVersion,
        profileId: safe.engine.profileId,
        ruleId: row.ruleId,
        ruleVersion: row.ruleVersion,
        outcome: row.outcome,
        engineImpact: row.engineImpact,
        occurrenceCount: row.occurrenceCount,
        countPrecision: row.countPrecision,
        samplesTruncated: row.samplesTruncated,
        sampledReferences: row.sampledReferences
          .slice()
          .sort((a, b) => a.ordinal - b.ordinal),
        wcagTags: row.wcagTags,
        wcagCriteria: row.wcagCriteria,
      },
    };
  } catch {
    return null;
  }
}
export type AccessibilityReportFinding = NonNullable<
  ReturnType<typeof projectAccessibilityReportFinding>
>;
export type AccessibilityReportLimitation =
  | "ASSESSMENT_NOT_PERSISTED"
  | "INVALID_ASSESSMENT"
  | "FINDINGS_OMITTED"
  | "SCAN_NOT_COMPLETED";
export interface AccessibilityReport {
  scan: { id: string; status: string; completedAt: string | null };
  assessment: {
    state: AccessibilityAssessmentState;
    coverage: AccessibilityCoverage | null;
    limitations: AccessibilityReportLimitation[];
  };
  summary: {
    findingCount: number;
    countsBySeverity: Record<AccessibilityReportSeverity, number>;
    highestSeverity: AccessibilityReportSeverity | null;
  };
  findings: AccessibilityReportFinding[];
}
