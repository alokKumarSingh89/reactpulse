/** Sprint 14.4 approved synthetic good-boundary policy. These are not field
 * percentile verdicts or configurable budgets. No poor/severe bands implied. */
export const PERFORMANCE_FINDING_RULES = {
  "performance.lcp.above-good-threshold": {
    metric: "lcp",
    unit: "ms",
    threshold: 2500,
    title: "Synthetic LCP above good threshold",
    description:
      "The synthetic scan measured Largest Contentful Paint above the 2,500 ms good-threshold boundary.",
    recommendation:
      "Investigate document delivery, resource loading and rendering along the LCP path; this measurement does not identify a root cause.",
  },
  "performance.synthetic-cls.above-good-threshold": {
    metric: "synthetic_cls",
    unit: "score",
    threshold: 0.1,
    title: "Synthetic CLS above good threshold",
    description:
      "The synthetic scan measured cumulative layout shift above the 0.1 good-threshold boundary.",
    recommendation:
      "Investigate layout instability during loading, including reserved space and late content changes; this measurement does not identify a responsible element.",
  },
} as const;
export type PerformanceFindingRuleId = keyof typeof PERFORMANCE_FINDING_RULES;
export type PerformanceFindingMetric =
  (typeof PERFORMANCE_FINDING_RULES)[PerformanceFindingRuleId]["metric"];
/** score preserves ScanMetric's unit label: CLS is unitless, not a health score. */
export type PerformanceFindingEvidence = {
  version: 1;
  context: "SYNTHETIC";
  measuredValue: number;
  comparison: "GT";
} & (
  | { metric: "lcp"; unit: "ms"; threshold: 2500 }
  | { metric: "synthetic_cls"; unit: "score"; threshold: 0.1 }
);
export function projectPerformanceFindingEvidence(
  value: unknown,
): PerformanceFindingEvidence | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const r = value as Record<string, unknown>;
    if (
      r.version !== 1 ||
      r.context !== "SYNTHETIC" ||
      r.comparison !== "GT" ||
      typeof r.measuredValue !== "number" ||
      !Number.isFinite(r.measuredValue) ||
      r.measuredValue < 0
    )
      return null;
    const base = {
      version: 1,
      context: "SYNTHETIC",
      comparison: "GT",
      measuredValue: r.measuredValue,
    } as const;
    if (
      r.metric === "lcp" &&
      r.unit === "ms" &&
      r.threshold === 2500 &&
      r.measuredValue > 2500
    )
      return { ...base, metric: "lcp", unit: "ms", threshold: 2500 };
    if (
      r.metric === "synthetic_cls" &&
      r.unit === "score" &&
      r.threshold === 0.1 &&
      r.measuredValue > 0.1
    )
      return {
        ...base,
        metric: "synthetic_cls",
        unit: "score",
        threshold: 0.1,
      };
    return null;
  } catch {
    return null;
  }
}
