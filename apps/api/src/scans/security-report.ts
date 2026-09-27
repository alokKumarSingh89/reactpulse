import type { SecurityAssessmentCoverage } from '@reactpulse/contracts';

import {
  projectSecurityFinding as projectFinding,
  SECURITY_COVERAGE_REASONS as reasons,
} from '@reactpulse/contracts';
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function member<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === 'string' && values.includes(value as T);
}
const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;

export interface SecurityReportInput {
  id: string;
  status: string;
  completedAt: Date | null;
  evidence: readonly { data: unknown }[];
  findings: readonly unknown[];
}
type Limitation =
  | 'SCAN_NOT_COMPLETED'
  | 'ASSESSMENT_NOT_PERSISTED'
  | 'INVALID_ASSESSMENT'
  | 'FINDINGS_OMITTED'
  | 'OBSERVATIONS_NOT_PERSISTED';

export function buildSecurityReport(scan: SecurityReportInput) {
  let state: SecurityAssessmentCoverage['state'] | 'NOT_ASSESSED' =
    'UNAVAILABLE';
  let coverage: SecurityAssessmentCoverage | null = null;
  const limitations: Limitation[] = ['OBSERVATIONS_NOT_PERSISTED'];
  let findings: NonNullable<ReturnType<typeof projectFinding>>[] = [];
  if (scan.status !== 'COMPLETED') limitations.push('SCAN_NOT_COMPLETED');
  else if (scan.evidence.length === 0) {
    state = 'NOT_ASSESSED';
    limitations.push('ASSESSMENT_NOT_PERSISTED');
  } else {
    const marker = record(scan.evidence[0]?.data);
    const raw = record(marker.coverage);
    if (
      marker.kind !== 'PASSIVE_SECURITY_ASSESSMENT' ||
      raw.version !== 1 ||
      raw.rulesetVersion !== 1 ||
      !member(['COMPLETE', 'PARTIAL', 'UNAVAILABLE'] as const, raw.state) ||
      !Array.isArray(raw.reasons) ||
      raw.reasons.length > reasons.length ||
      !raw.reasons.every((reason: unknown) => member(reasons, reason))
    ) {
      limitations.push('INVALID_ASSESSMENT');
    } else {
      coverage = {
        version: 1,
        rulesetVersion: 1,
        state: raw.state,
        reasons: reasons.filter((reason) =>
          (raw.reasons as unknown[]).includes(reason),
        ),
      };
      state = coverage.state;
      if (state !== 'UNAVAILABLE') {
        for (const row of scan.findings) {
          const finding = projectFinding(row);
          if (finding) findings.push(finding);
          else if (
            record(row).category === 'SECURITY' &&
            !limitations.includes('FINDINGS_OMITTED')
          )
            limitations.push('FINDINGS_OMITTED');
        }
        if (limitations.includes('FINDINGS_OMITTED')) state = 'PARTIAL';
      }
    }
  }
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  findings = findings.sort(
    (a, b) =>
      severities.indexOf(a.severity) - severities.indexOf(b.severity) ||
      compare(a.ruleId, b.ruleId) ||
      compare(a.affectedResource, b.affectedResource) ||
      compare(a.status, b.status) ||
      compare(a.confidence, b.confidence),
  );
  return {
    scan: { id: scan.id, status: scan.status, completedAt: scan.completedAt },
    assessment: { state, coverage, limitations },
    observations: {
      state: 'UNAVAILABLE' as const,
      reason: 'OBSERVATIONS_NOT_PERSISTED' as const,
    },
    findings,
  };
}
