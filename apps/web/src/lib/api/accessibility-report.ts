import {
  ACCESSIBILITY_REPORT_SEVERITIES,
  ACCESSIBILITY_RULE_IDS,
  projectAccessibilityCoverage,
  projectAccessibilityReportFinding,
  type AccessibilityReport,
} from "@reactpulse/contracts";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Transport projection only. Reject inconsistent payloads rather than infer
 * assessment state from findings. Shared validators own evidence vocabulary. */
export function projectAccessibilityReport(
  value: unknown,
): AccessibilityReport | null {
  try {
    const raw = record(value),
      scan = record(raw.scan),
      assessment = record(raw.assessment);
    const summary = record(raw.summary),
      counts = record(summary.countsBySeverity);
    const states = [
      "COMPLETE",
      "PARTIAL",
      "UNAVAILABLE",
      "NOT_ASSESSED",
    ] as const;
    const state = states.find((s) => s === assessment.state);
    const statuses = [
      "PENDING",
      "QUEUED",
      "RUNNING",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ];
    const allowedLimitations = [
      "ASSESSMENT_NOT_PERSISTED",
      "INVALID_ASSESSMENT",
      "FINDINGS_OMITTED",
      "SCAN_NOT_COMPLETED",
    ] as const;
    if (
      !state ||
      typeof scan.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        scan.id,
      ) ||
      typeof scan.status !== "string" ||
      !statuses.includes(scan.status) ||
      !(
        scan.completedAt === null ||
        (typeof scan.completedAt === "string" &&
          /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(scan.completedAt) &&
          Number.isFinite(Date.parse(scan.completedAt)))
      ) ||
      !Array.isArray(assessment.limitations) ||
      assessment.limitations.length > allowedLimitations.length ||
      !assessment.limitations.every((v) =>
        allowedLimitations.some((a) => a === v),
      ) ||
      !Array.isArray(raw.findings) ||
      raw.findings.length > ACCESSIBILITY_RULE_IDS.length
    )
      return null;
    const limitations = assessment.limitations;
    const coverage =
      assessment.coverage === null
        ? null
        : projectAccessibilityCoverage(assessment.coverage);
    if (
      state === "NOT_ASSESSED"
        ? assessment.coverage !== null
        : !coverage || coverage.state !== state
    )
      return null;
    if (
      (state === "UNAVAILABLE" || state === "NOT_ASSESSED") &&
      raw.findings.length
    )
      return null;
    const findings: AccessibilityReport["findings"] = [];
    for (const item of raw.findings) {
      const finding = projectAccessibilityReportFinding(item);
      if (!finding || findings.some((f) => f.ruleId === finding.ruleId))
        return null;
      findings.push(finding);
    }
    const countsBySeverity: AccessibilityReport["summary"]["countsBySeverity"] =
      { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    for (const finding of findings) countsBySeverity[finding.severity]++;
    const highestSeverity =
      ACCESSIBILITY_REPORT_SEVERITIES.find((s) => countsBySeverity[s] > 0) ??
      null;
    if (
      summary.findingCount !== findings.length ||
      summary.highestSeverity !== highestSeverity ||
      ACCESSIBILITY_REPORT_SEVERITIES.some(
        (s) => counts[s] !== countsBySeverity[s],
      )
    )
      return null;
    return {
      scan: { id: scan.id, status: scan.status, completedAt: scan.completedAt },
      assessment: {
        state,
        coverage,
        limitations: allowedLimitations.filter((v) => limitations.includes(v)),
      },
      summary: {
        findingCount: findings.length,
        countsBySeverity,
        highestSeverity,
      },
      findings,
    };
  } catch {
    return null;
  }
}
