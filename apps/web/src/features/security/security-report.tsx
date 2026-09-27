"use client";

import {
  projectSecurityReport,
  type SecurityReportResponse,
} from "@reactpulse/contracts";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

const states = {
  COMPLETE: [
    "Assessment complete",
    "Passive security checks completed for this scan.",
  ],
  PARTIAL: [
    "Partial assessment",
    "Some passive observations were unavailable, so absence of a finding does not imply the condition was checked.",
  ],
  UNAVAILABLE: [
    "Assessment unavailable",
    "Security observations could not be collected or the scan has not completed.",
  ],
  NOT_ASSESSED: [
    "Not assessed",
    "Security analysis was not performed for this scan. Run a new scan to generate security intelligence.",
  ],
} as const;
const categories: Record<string, string> = {
  navigation: "Transport",
  csp: "Content Security",
  framing: "Framing",
  cookies: "Cookies",
  hsts: "Browser Policies",
  contentTypeOptions: "Browser Policies",
  referrerPolicy: "Browser Policies",
  permissionsPolicy: "Browser Policies",
};
const limitations: Record<string, string> = {
  OBSERVATIONS_NOT_PERSISTED:
    "Detailed observations were not retained; only coverage and finding evidence are available.",
  SCAN_NOT_COMPLETED: "This scan has not completed successfully.",
  ASSESSMENT_NOT_PERSISTED: "No security assessment was recorded.",
  INVALID_ASSESSMENT: "Stored assessment data could not be read.",
  FINDINGS_OMITTED: "Some stored findings could not be safely included.",
  MAIN_DOCUMENT_UNAVAILABLE: "Main document unavailable.",
  HEADERS_UNAVAILABLE: "Response headers unavailable.",
  COOKIE_OBSERVATION_UNAVAILABLE: "Cookie observations unavailable.",
  NETWORK_OBSERVATION_UNAVAILABLE: "Network observations unavailable.",
  INITIATOR_UNKNOWN: "Request initiator could not be established.",
  NAVIGATION_CHANGED: "Navigation changed during observation.",
  UNSUPPORTED_SYNTAX: "Some policy syntax was unsupported.",
  OBSERVATION_LIMIT_REACHED: "An observation limit was reached.",
  COLLECTION_FAILED: "Some observations could not be collected.",
};
export type SecurityReportData = SecurityReportResponse;
const surface = "rounded-lg border border-slate-200 bg-white";
const focus =
  "rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600";

export function SecuritySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading security report"
      className="space-y-4"
    >
      <span className="sr-only">Loading security report</span>
      <div className={`${surface} h-24 bg-slate-100`} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`${surface} h-28 bg-slate-100`} />
        ))}
      </div>
      <div className={`${surface} h-48 bg-slate-100`} />
    </div>
  );
}

export function SecurityReport({ scanId }: { scanId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    report?: SecurityReportData;
    error?: boolean;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/security?scanId=${encodeURIComponent(scanId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const report = projectSecurityReport(await response.json());
        if (!report || report.scan.id !== scanId) throw new Error();
        if (!controller.signal.aborted) setResult({ report });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ error: true });
      });
    return () => controller.abort();
  }, [scanId, attempt]);
  if (!result) return <SecuritySkeleton />;
  if (!result.report)
    return (
      <section role="alert" className={`${surface} p-5`}>
        <h2 className="font-semibold">Security report unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">
          We couldn’t load security analysis for this scan.
        </p>
        <button
          className={`mt-4 text-sm font-medium text-blue-700 ${focus}`}
          onClick={() => {
            setResult(null);
            setAttempt((a) => a + 1);
          }}
        >
          Try again
        </button>
      </section>
    );
  return <SecurityReportView report={result.report} />;
}

export function SecurityReportView({ report }: { report: SecurityReportData }) {
  const { assessment, findings } = report;
  const [title, explanation] = states[assessment.state];
  const assessed =
    assessment.state === "COMPLETE" || assessment.state === "PARTIAL";
  const highest = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].find((s) =>
    findings.some((f) => f.severity === s),
  );
  return (
    <div className="space-y-5">
      <section className={`${surface} p-4`} aria-label="Security overview">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant={assessment.state === "PARTIAL" ? "warning" : "neutral"}
          >
            {title}
          </Badge>
          <p className="text-sm text-slate-600">{explanation}</p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm md:grid-cols-4">
          {[
            ["Assessment", title],
            ["Findings", assessed ? findings.length : "Unavailable"],
            [
              "Highest observed severity",
              highest ?? (assessed ? "None reported" : "Unavailable"),
            ],
            ["Coverage", "Passive"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="findings-heading" className={surface}>
        <h2
          id="findings-heading"
          className="border-b border-slate-100 px-4 py-3 font-semibold"
        >
          Findings{" "}
          {assessed && (
            <span className="ml-2 text-sm text-slate-500">
              {findings.length}
            </span>
          )}
        </h2>
        {!findings.length && (
          <div className="p-4 text-sm text-slate-600">
            {assessment.state === "COMPLETE"
              ? "No reportable conditions detected by the passive checks performed."
              : assessment.state === "PARTIAL"
                ? "No findings are available from the partial assessment. This does not imply all conditions were checked."
                : explanation}
          </div>
        )}
        {findings.map((finding, index) => (
          <details
            key={`${finding.ruleId}-${index}`}
            className="border-b border-slate-100 last:border-0"
          >
            <summary className={`cursor-pointer px-4 py-3 ${focus}`}>
              <span className="ml-2 inline-flex max-w-full flex-wrap items-center gap-2">
                <Badge
                  variant={
                    finding.severity === "HIGH" ||
                    finding.severity === "CRITICAL"
                      ? "danger"
                      : finding.severity === "MEDIUM"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {finding.severity}
                </Badge>
                <span className="break-words text-sm font-semibold">
                  {finding.title}
                </span>
                <span className="text-xs text-slate-500">
                  {categories[finding.evidence.source] ?? "Security"} · Inspect
                </span>
              </span>
              <p className="mt-2 text-sm text-slate-600">
                {finding.description}
              </p>
            </summary>
            <div className="space-y-3 border-t border-slate-100 bg-slate-50 px-5 py-4 text-sm">
              <p>Confidence: {finding.confidence}</p>
              <div>
                <h3 className="font-medium">Why this was reported</h3>
                <p className="mt-1 text-slate-600">{finding.description}</p>
              </div>
              <div>
                <h3 className="font-medium">Observed evidence</h3>
                <p className="mt-1 text-slate-600">
                  {categories[finding.evidence.source] ?? "Security"} condition
                  recorded by the passive scan.
                </p>
                <p>
                  {finding.evidence.subject.kind === "COOKIE" &&
                  Number.isSafeInteger(
                    finding.evidence.subject.cookieOrdinal,
                  ) &&
                  Number.isSafeInteger(
                    finding.evidence.subject.documentResponseOrdinal,
                  )
                    ? `Response ${finding.evidence.subject.documentResponseOrdinal}, cookie reference ${finding.evidence.subject.cookieOrdinal}`
                    : "Main document"}
                </p>
              </div>
              <div>
                <h3 className="font-medium">Recommendation</h3>
                <p className="mt-1 text-slate-600">{finding.recommendation}</p>
              </div>
              <p className="break-all text-xs text-slate-500">
                Rule: {finding.ruleId}
              </p>
            </div>
          </details>
        ))}
      </section>
      <section aria-labelledby="posture-heading">
        <h2 id="posture-heading" className="mb-3 font-semibold">
          Observed security posture
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            "Transport",
            "Content Security",
            "Framing",
            "Cookies",
            "Browser Policies",
            "Mixed Content",
          ].map((category) => {
            const count = findings.filter(
              (f) => categories[f.evidence.source] === category,
            ).length;
            return (
              <div key={category} className={`${surface} min-h-28 p-4`}>
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {category}
                </h3>
                <p className="mt-2 text-sm font-semibold">
                  {category === "Mixed Content"
                    ? "Not evaluated"
                    : count
                      ? `${count} reported ${count === 1 ? "condition" : "conditions"}`
                      : "Observations unavailable"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {category === "Mixed Content"
                    ? "No mixed-content evaluation is available in this report."
                    : "Detailed observations are not retained. Absence of findings is not evidence of protection."}
                </p>
              </div>
            );
          })}
        </div>
      </section>
      <section className={`${surface} p-4`}>
        <h2 className="font-semibold">Assessment details</h2>
        <p className="mt-2 text-sm text-slate-600">
          Passive analysis
          {assessment.coverage
            ? ` · Recorded coverage: ${assessment.coverage.state} · Ruleset v${assessment.coverage.rulesetVersion} · Contract v${assessment.coverage.version}`
            : " · Versions unavailable"}
        </p>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {[
            ...new Set([
              ...assessment.limitations,
              ...(assessment.coverage?.reasons ?? []),
            ]),
          ].map((reason, i) => (
            <li key={i}>
              {limitations[reason] ??
                "Additional observation limitations apply."}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          ReactPulse evaluates observations collected during the browser scan.
          It does not actively probe or exploit the target.
        </p>
      </section>
    </div>
  );
}
