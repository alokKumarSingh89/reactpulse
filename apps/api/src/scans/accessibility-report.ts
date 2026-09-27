import {
  ACCESSIBILITY_REPORT_SEVERITIES,
  projectAccessibilityMarker,
  projectAccessibilityReportFinding,
  type AccessibilityReport,
} from '@reactpulse/contracts';

export interface AccessibilityReportInput {
  id: string;
  status: string;
  completedAt: Date | null;
  evidence: readonly { data: unknown }[];
  findings: readonly unknown[];
}
export function buildAccessibilityReport(
  scan: AccessibilityReportInput,
): AccessibilityReport {
  // The unique scan/type/sequence key identifies one marker; never choose
  // arbitrarily if malformed input supplies multiple authoritative records.
  const coverage =
    scan.evidence.length === 1
      ? projectAccessibilityMarker(scan.evidence[0].data)
      : null;
  const limitations: AccessibilityReport['assessment']['limitations'] = [];
  if (!coverage)
    limitations.push(
      scan.evidence.length ? 'INVALID_ASSESSMENT' : 'ASSESSMENT_NOT_PERSISTED',
    );
  if (scan.status !== 'COMPLETED') limitations.push('SCAN_NOT_COMPLETED');
  const findings: AccessibilityReport['findings'] = [];
  if (
    coverage &&
    (coverage.state === 'COMPLETE' || coverage.state === 'PARTIAL')
  ) {
    for (const raw of scan.findings) {
      const finding = projectAccessibilityReportFinding(raw);
      if (finding) findings.push(finding);
      else if (!limitations.includes('FINDINGS_OMITTED'))
        limitations.push('FINDINGS_OMITTED');
    }
  }
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  findings.sort(
    (a, b) =>
      ACCESSIBILITY_REPORT_SEVERITIES.indexOf(a.severity) -
        ACCESSIBILITY_REPORT_SEVERITIES.indexOf(b.severity) ||
      compare(a.ruleId, b.ruleId) ||
      compare(a.status, b.status) ||
      compare(JSON.stringify(a.evidence), JSON.stringify(b.evidence)),
  );
  const countsBySeverity: AccessibilityReport['summary']['countsBySeverity'] = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  for (const finding of findings) countsBySeverity[finding.severity]++;
  return {
    scan: {
      id: scan.id,
      status: scan.status,
      completedAt: scan.completedAt?.toISOString() ?? null,
    },
    assessment: {
      state: coverage?.state ?? 'NOT_ASSESSED',
      coverage,
      limitations,
    },
    summary: {
      findingCount: findings.length,
      countsBySeverity,
      highestSeverity:
        ACCESSIBILITY_REPORT_SEVERITIES.find((s) => countsBySeverity[s] > 0) ??
        null,
    },
    findings,
  };
}
