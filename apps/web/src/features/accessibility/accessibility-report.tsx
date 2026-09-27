"use client";

import { useEffect, useState } from "react";
import {
  ACCESSIBILITY_REPORT_SEVERITIES,
  type AccessibilityReport as Report,
} from "@reactpulse/contracts";
import { Badge } from "@/components/ui/badge";
import { projectAccessibilityReport } from "@/lib/api/accessibility-report";

const surface = "rounded-lg border border-slate-200 bg-white";
const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const states = {
  COMPLETE: [
    "Assessment complete",
    "Configured automated checks completed for this scan’s defined scope.",
  ],
  PARTIAL: [
    "Partial assessment",
    "Accessibility evaluation completed with limited coverage.",
  ],
  UNAVAILABLE: [
    "Assessment unavailable",
    "Automated accessibility evaluation could not produce a usable assessment. Run another scan from your project environment.",
  ],
  NOT_ASSESSED: [
    "Not assessed",
    "This scan was not evaluated for accessibility. A newer scan can provide accessibility observations.",
  ],
} as const;
const reasons: Record<string, string> = {
  ENGINE_UNAVAILABLE: "The accessibility engine was unavailable.",
  ENGINE_TIMEOUT: "Automated evaluation reached its time limit.",
  PAGE_CONTEXT_UNAVAILABLE: "The page context was unavailable.",
  NAVIGATION_CHANGED: "Navigation changed during evaluation.",
  RESULT_LIMIT_EXCEEDED: "A result or sample limit was reached.",
  NODE_LIMIT_REACHED: "The document exceeded the node limit.",
  FRAME_COVERAGE_PARTIAL: "Frame content was excluded from evaluation.",
  UNSUPPORTED_RULE: "Some engine rules were unsupported.",
  REFERENCE_UNAVAILABLE: "Some structural references were unavailable.",
  NEEDS_REVIEW: "Some observations require manual review.",
  INVALID_ENGINE_RESULT: "Some engine results could not be safely interpreted.",
  ANALYSIS_NOT_RUN: "Automated evaluation was not run.",
  ASSESSMENT_NOT_PERSISTED: "No assessment was recorded for this scan.",
  INVALID_ASSESSMENT: "Stored assessment data could not be read safely.",
  FINDINGS_OMITTED: "Some stored findings could not be safely included.",
  SCAN_NOT_COMPLETED: "This scan has not completed successfully.",
};
const wcag: Record<string, string> = {
  wcag2a: "WCAG 2 A",
  wcag2aa: "WCAG 2 AA",
  wcag21a: "WCAG 2.1 A",
  wcag21aa: "WCAG 2.1 AA",
  wcag22aa: "WCAG 2.2 AA",
};
export function AccessibilitySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading accessibility report"
      className="space-y-4"
    >
      <span className="sr-only">Loading accessibility report</span>
      <div className={`${surface} h-24 bg-slate-100`} />
      <div className={`${surface} h-32 bg-slate-100`} />
      <div className={`${surface} divide-y divide-slate-200`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
export function AccessibilityReportError({ retry }: { retry: () => void }) {
  return (
    <section role="alert" className={`${surface} p-4`}>
      <h2 className="font-semibold">Accessibility report unavailable</h2>
      <p className="mt-1 text-sm text-slate-600">
        We couldn’t load automated accessibility observations for this scan.
      </p>
      <button
        className={`mt-3 rounded text-sm font-medium text-blue-700 ${focus}`}
        onClick={retry}
      >
        Try again
      </button>
    </section>
  );
}
export function AccessibilityReport({ scanId }: { scanId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    report?: Report;
    error?: boolean;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/accessibility?scanId=${encodeURIComponent(scanId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const report = projectAccessibilityReport(await response.json());
        if (!report || report.scan.id !== scanId) throw new Error();
        if (!controller.signal.aborted) setResult({ report });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ error: true });
      });
    return () => controller.abort();
  }, [scanId, attempt]);
  if (!result) return <AccessibilitySkeleton />;
  if (!result.report)
    return (
      <AccessibilityReportError
        retry={() => {
          setResult(null);
          setAttempt((a) => a + 1);
        }}
      />
    );
  return <AccessibilityReportView report={result.report} />;
}
export function AccessibilityReportView({ report: input }: { report: Report }) {
  // Defense at the rendering boundary as well as transport: never trust extra
  // properties or stored prose, even when fixtures/callers bypass the loader.
  const report = projectAccessibilityReport(input);
  if (!report)
    return (
      <section role="alert" className={`${surface} p-4`}>
        Accessibility report data is unavailable.
      </section>
    );
  const { assessment, summary, findings } = report;
  const coverage = assessment.coverage;
  const assessed =
    assessment.state === "COMPLETE" || assessment.state === "PARTIAL";
  const [title, explanation] = states[assessment.state];
  return (
    <div className="space-y-4">
      <section aria-label="Accessibility overview" className={`${surface} p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={assessment.state === "PARTIAL" ? "warning" : "neutral"}
          >
            {title}
          </Badge>
          <p className="text-sm text-slate-600">{explanation}</p>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm md:grid-cols-4">
          {[
            ["Assessment", title],
            ["Findings", assessed ? summary.findingCount : "Unavailable"],
            [
              "Highest severity",
              assessed
                ? (summary.highestSeverity ?? "None reported")
                : "Unavailable",
            ],
            ["Scope", coverage ? "Main document" : "Not recorded"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Automated checks cannot detect every accessibility issue.
        </p>
      </section>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className={`${surface} p-4`} aria-labelledby="a11y-coverage">
          <h2 id="a11y-coverage" className="text-sm font-semibold">
            Automated coverage
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {[
              [
                "Main document",
                coverage
                  ? coverage.mainDocumentEvaluated
                    ? "Evaluated"
                    : "Not evaluated"
                  : "Not recorded",
              ],
              [
                "Frames",
                coverage
                  ? `${coverage.excludedFrameCount} excluded · main-document scope`
                  : "Not recorded",
              ],
              [
                "Result limits",
                coverage
                  ? coverage.reasons.includes("RESULT_LIMIT_EXCEEDED")
                    ? "Result or sample limit reached"
                    : "No result limit recorded"
                  : "Not recorded",
              ],
              [
                "Engine",
                coverage?.engine
                  ? `${coverage.engine.name} ${coverage.engine.version}`
                  : "Unavailable",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="mt-1 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            {[
              ...new Set([
                ...assessment.limitations,
                ...(coverage?.reasons ?? []),
              ]),
            ].map((reason) => (
              <li key={reason}>
                {reasons[reason] ?? "Additional evaluation limitations apply."}
              </li>
            ))}
          </ul>
        </section>
        <section
          className={`${surface} p-4`}
          aria-labelledby="a11y-distribution"
        >
          <h2 id="a11y-distribution" className="text-sm font-semibold">
            Findings by severity
          </h2>
          {assessed ? (
            <ul className="mt-3 space-y-2">
              {ACCESSIBILITY_REPORT_SEVERITIES.map((severity) => (
                <li key={severity} className="flex items-center gap-3 text-xs">
                  <span className="w-16 text-slate-600">{severity}</span>
                  <span
                    aria-hidden="true"
                    className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100"
                  >
                    <span
                      className="block h-full bg-blue-500"
                      style={{
                        width: `${summary.findingCount ? (100 * summary.countsBySeverity[severity]) / summary.findingCount : 0}%`,
                      }}
                    />
                  </span>
                  <span className="w-5 text-right font-semibold tabular-nums">
                    {summary.countsBySeverity[severity]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Distribution unavailable.
            </p>
          )}
        </section>
      </div>
      <section className={surface} aria-labelledby="a11y-findings">
        <h2
          id="a11y-findings"
          className="border-b border-slate-100 px-4 py-3 text-sm font-semibold"
        >
          Findings{" "}
          {assessed && (
            <span className="ml-2 text-slate-500">{summary.findingCount}</span>
          )}
        </h2>
        {!findings.length && (
          <p className="p-4 text-sm text-slate-600">
            {assessment.state === "COMPLETE"
              ? "No reportable conditions were detected by the automated checks in this scan."
              : assessment.state === "PARTIAL"
                ? "No findings are available from the partial evaluation. Untested areas still require review."
                : explanation}
          </p>
        )}
        {findings.map((f) => (
          <details
            key={f.ruleId}
            className="border-b border-slate-100 last:border-0"
          >
            <summary className={`cursor-pointer px-4 py-3 ${focus}`}>
              <span className="ml-1 inline-grid w-[calc(100%-1.5rem)] grid-cols-1 gap-2 align-middle md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      f.severity === "HIGH"
                        ? "danger"
                        : f.severity === "MEDIUM"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {f.severity}
                  </Badge>
                  <span className="text-sm font-semibold break-words">
                    {f.title}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>
                    {f.evidence.countPrecision === "LOWER_BOUND"
                      ? "At least "
                      : ""}
                    {f.evidence.occurrenceCount} occurrences
                  </span>
                  <span>
                    {f.evidence.sampledReferences.length}{" "}
                    {f.evidence.sampledReferences.length === 1
                      ? "sample"
                      : "samples"}
                  </span>
                  <span className="font-medium text-blue-700">Inspect</span>
                </span>
              </span>
            </summary>
            <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-4 text-sm">
              <p className="text-xs text-slate-600">
                Engine impact: {f.evidence.engineImpact} · Detection confidence:{" "}
                {f.confidence}
              </p>
              <div>
                <h3 className="font-medium">Why this was reported</h3>
                <p className="mt-1 text-slate-600">{f.description}</p>
              </div>
              <div>
                <h3 className="font-medium">Recommendation</h3>
                <p className="mt-1 text-slate-600">{f.recommendation}</p>
              </div>
              <div>
                <h3 className="font-medium">Referenced standards</h3>
                <p className="mt-1 text-slate-600">
                  {f.evidence.wcagTags.map((tag) => wcag[tag]).join(" · ") ||
                    "No standard tags recorded"}
                  {f.evidence.wcagCriteria.length > 0 &&
                    ` · Criteria ${f.evidence.wcagCriteria.join(", ")}`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Rule associations describe automated checks, not
                  whole-application conformance.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Structural references</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Showing {f.evidence.sampledReferences.length}{" "}
                  {f.evidence.sampledReferences.length === 1
                    ? "sample"
                    : "samples"}{" "}
                  from{" "}
                  {f.evidence.countPrecision === "LOWER_BOUND"
                    ? "at least "
                    : ""}
                  {f.evidence.occurrenceCount} occurrences.{" "}
                  {f.evidence.samplesTruncated && "Samples were limited."}{" "}
                  Approximate snapshot positions; indexes are zero-based.
                </p>
                {!f.evidence.sampledReferences.length ? (
                  <p className="mt-2 text-slate-600">
                    Structural references were unavailable.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {f.evidence.sampledReferences.map((ref) => (
                      <li
                        key={ref.ordinal}
                        className="break-words font-mono text-xs"
                      >
                        Sample {ref.ordinal}:{" "}
                        {ref.path
                          ?.map((s) => `${s.tag}[${s.index}]`)
                          .join(" → ") ??
                          `${ref.tag} · ancestry unavailable`}{" "}
                        · role {ref.role}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="break-all text-xs text-slate-500">
                Rule: {f.ruleId}
              </p>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
