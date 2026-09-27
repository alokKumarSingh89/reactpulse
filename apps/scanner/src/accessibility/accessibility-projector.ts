import {
  ACCESSIBILITY_CONTRACT_VERSION,
  ACCESSIBILITY_LIMITS as LIMITS,
  ACCESSIBILITY_REASONS,
  ACCESSIBILITY_RULE_IDS,
  ACCESSIBILITY_WCAG_TAGS,
  ACCESSIBILITY_WCAG_CRITERIA,
  projectAccessibilityAssessment,
  type AccessibilityAssessment,
  type AccessibilityElementReference,
  type AccessibilityReason,
  type AccessibilityRuleObservation,
} from '@reactpulse/contracts';

/** Optional scanner-owned sidecar from a future live-DOM collector. Never
 * reconstruct this from axe html/target/selector strings. Absence is explicit.
 * Node indexes refer to the engine array within the identified result group. */
export interface AccessibilityStructuralFact {
  group: 'violations' | 'incomplete' | 'passes' | 'inapplicable';
  ruleId: string;
  nodeIndex: number;
  tag: string;
  role: string;
  path: readonly { tag: string; index: number }[] | null;
}
const groups = [
  ['violations', 'VIOLATION'],
  ['incomplete', 'NEEDS_REVIEW'],
  ['passes', 'PASS'],
  ['inapplicable', 'INAPPLICABLE'],
] as const;
const MAX_RAW_RULES = LIMITS.rules;
const MAX_FACTS = ACCESSIBILITY_RULE_IDS.length * LIMITS.samplesPerRule;
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function integer(value: unknown, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= max
  );
}
function envelope(): AccessibilityAssessment {
  return {
    version: ACCESSIBILITY_CONTRACT_VERSION,
    state: 'UNAVAILABLE',
    engine: null,
    scope: 'MAIN_DOCUMENT',
    mainDocumentEvaluated: false,
    excludedFrameCount: 0,
    reasons: ['INVALID_ENGINE_RESULT'],
    durationMs: null,
    configuredRuleCount: 0,
    results: [],
  };
}
function token(value: unknown): string {
  return typeof value === 'string' && value.length <= 40
    ? value.toLowerCase()
    : '';
}

// Reuse the contract's structural vocabulary and bounds without maintaining a
// second tag/role allowlist. The temporary envelope is never returned/persisted.
function structuralReference(
  value: unknown,
  ordinal: number,
): AccessibilityElementReference | null {
  const fact = record(value);
  let path: { tag: string; index: unknown }[] | null = null;
  if (fact.path !== null) {
    if (
      !Array.isArray(fact.path) ||
      fact.path.length === 0 ||
      fact.path.length > LIMITS.pathSegments
    )
      return null;
    path = fact.path.map((value) => {
      const segment = record(value);
      return {
        tag: segment.tag === 'OTHER' ? 'OTHER' : token(segment.tag),
        index: segment.index,
      };
    });
  }
  const projected = projectAccessibilityAssessment({
    version: 1,
    state: 'PARTIAL',
    scope: 'MAIN_DOCUMENT',
    mainDocumentEvaluated: true,
    engine: {
      name: 'axe-core',
      version: '0.0.0',
      rulesetVersion: 1,
      profileId: 'main-document-v1',
    },
    excludedFrameCount: 0,
    reasons: ['REFERENCE_UNAVAILABLE'],
    durationMs: 0,
    configuredRuleCount: 1,
    results: [
      {
        ruleId: 'label',
        ruleVersion: 1,
        outcome: 'PASS',
        engineImpact: 'UNKNOWN',
        occurrenceCount: 1,
        countPrecision: 'EXACT',
        samplesTruncated: false,
        wcagTags: [],
        wcagCriteria: [],
        sampledReferences: [
          {
            ordinal,
            tag: fact.tag === 'OTHER' ? 'OTHER' : token(fact.tag),
            role: fact.role === 'UNKNOWN' ? 'UNKNOWN' : token(fact.role),
            path,
          },
        ],
      },
    ],
  });
  return projected?.results[0].sampledReferences[0] ?? null;
}

/** Pure privacy boundary. Raw engine types remain scanner-local. Extra fields
 * are ignored, known malformed fields produce bounded coverage gaps, and no raw
 * URL, text, HTML, selector, error, or engine prose is inspected or copied.
 * Identical input/order yields identical output; rule/tag/reason order is fixed.
 */
export function projectAccessibilityObservation(
  input: unknown,
  structuralFacts: readonly AccessibilityStructuralFact[] = [],
): AccessibilityAssessment {
  try {
    return project(input, structuralFacts);
  } catch {
    return envelope();
  }
}
function project(
  input: unknown,
  structuralFacts: readonly AccessibilityStructuralFact[],
): AccessibilityAssessment {
  const rawInput = record(input);
  const result = envelope();
  if (
    rawInput.engine !== 'axe-core' ||
    rawInput.rulesetVersion !== 1 ||
    rawInput.scope !== 'MAIN_DOCUMENT' ||
    typeof rawInput.engineVersion !== 'string' ||
    rawInput.engineVersion.length > 20 ||
    !/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(rawInput.engineVersion) ||
    typeof rawInput.durationMs !== 'number' ||
    !Number.isFinite(rawInput.durationMs) ||
    rawInput.durationMs < 0 ||
    rawInput.durationMs > LIMITS.durationMs ||
    !integer(rawInput.excludedFrameCount, LIMITS.frames)
  )
    return result;
  result.engine = {
    name: 'axe-core',
    version: rawInput.engineVersion,
    rulesetVersion: 1,
    profileId: 'main-document-v1',
  };
  result.durationMs = rawInput.durationMs;
  result.excludedFrameCount = rawInput.excludedFrameCount;
  result.configuredRuleCount = ACCESSIBILITY_RULE_IDS.length;
  const reasons = new Set<AccessibilityReason>();
  if (result.excludedFrameCount) reasons.add('FRAME_COVERAGE_PARTIAL');
  if (rawInput.state === 'UNAVAILABLE') {
    const failures = [
      'ENGINE_TIMEOUT',
      'ENGINE_UNAVAILABLE',
      'PAGE_CONTEXT_UNAVAILABLE',
      'NODE_LIMIT_REACHED',
      'NAVIGATION_CHANGED',
    ] as const;
    const reason =
      failures.find((r) => r === rawInput.reason) ?? 'INVALID_ENGINE_RESULT';
    reasons.add(reason);
    result.reasons = ACCESSIBILITY_REASONS.filter((r) => reasons.has(r));
    return projectAccessibilityAssessment(result) ?? envelope();
  }
  if (rawInput.state !== 'SUCCEEDED') return envelope();
  const raw = record(rawInput.raw);
  const results: AccessibilityRuleObservation[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  let visited = 0,
    ordinal = 0;
  const facts = Array.isArray(structuralFacts)
    ? structuralFacts.slice(0, MAX_FACTS)
    : [];
  if (structuralFacts.length > MAX_FACTS) reasons.add('RESULT_LIMIT_EXCEEDED');
  for (const [group, outcome] of groups) {
    const rows = raw[group];
    if (!Array.isArray(rows)) {
      reasons.add('INVALID_ENGINE_RESULT');
      continue;
    }
    if (rows.length > MAX_RAW_RULES - visited)
      reasons.add('RESULT_LIMIT_EXCEEDED');
    const bounded = rows.slice(0, Math.max(0, MAX_RAW_RULES - visited));
    visited += bounded.length;
    for (const value of bounded) {
      const row = record(value);
      const ruleId = ACCESSIBILITY_RULE_IDS.find((id) => id === row.id);
      if (!ruleId) {
        reasons.add('UNSUPPORTED_RULE');
        continue;
      }
      if (seen.has(ruleId)) {
        duplicates.add(ruleId);
        reasons.add('INVALID_ENGINE_RESULT');
        continue;
      }
      seen.add(ruleId);
      if (
        !Array.isArray(row.nodes) ||
        (outcome === 'INAPPLICABLE'
          ? row.nodes.length !== 0
          : outcome !== 'PASS' && row.nodes.length === 0)
      ) {
        reasons.add('INVALID_ENGINE_RESULT');
        continue;
      }
      const count = Math.min(row.nodes.length, LIMITS.occurrences);
      const lowerBound = row.nodes.length > LIMITS.occurrences;
      const truncated = row.nodes.length > LIMITS.samplesPerRule;
      if (lowerBound || truncated) reasons.add('RESULT_LIMIT_EXCEEDED');
      if (outcome === 'NEEDS_REVIEW') reasons.add('NEEDS_REVIEW');
      const sampledReferences: AccessibilityElementReference[] = [];
      for (
        let index = 0;
        index < Math.min(count, LIMITS.samplesPerRule);
        index++
      ) {
        const node = row.nodes[index];
        if (!node || typeof node !== 'object' || Array.isArray(node)) {
          reasons.add('INVALID_ENGINE_RESULT');
          reasons.add('REFERENCE_UNAVAILABLE');
          continue;
        }
        const matches = facts.filter(
          (f) =>
            f.group === group && f.ruleId === ruleId && f.nodeIndex === index,
        );
        const ref =
          matches.length === 1
            ? structuralReference(matches[0], ordinal)
            : null;
        if (ref) {
          sampledReferences.push(ref);
          ordinal++;
          if (ref.path === null) reasons.add('REFERENCE_UNAVAILABLE');
        } else reasons.add('REFERENCE_UNAVAILABLE');
      }
      const impact = ['MINOR', 'MODERATE', 'SERIOUS', 'CRITICAL'].find(
        (i) => i.toLowerCase() === token(row.impact),
      ) as AccessibilityRuleObservation['engineImpact'] | undefined;
      if (!impact && outcome === 'VIOLATION') reasons.add('NEEDS_REVIEW');
      const rawTags = Array.isArray(row.tags) ? row.tags.slice(0, 256) : [];
      if (Array.isArray(row.tags) && row.tags.length > 256)
        reasons.add('RESULT_LIMIT_EXCEEDED');
      const normalizedTags = new Set(rawTags.map(token));
      results.push({
        ruleId,
        ruleVersion: 1,
        outcome,
        engineImpact: impact ?? 'UNKNOWN',
        occurrenceCount: count,
        countPrecision: lowerBound ? 'LOWER_BOUND' : 'EXACT',
        sampledReferences,
        samplesTruncated: truncated,
        wcagTags: ACCESSIBILITY_WCAG_TAGS.filter((t) => normalizedTags.has(t)),
        wcagCriteria: ACCESSIBILITY_WCAG_CRITERIA.filter((c) =>
          normalizedTags.has(`wcag${c.replaceAll('.', '')}`),
        ),
      });
    }
  }
  const ordered = ACCESSIBILITY_RULE_IDS.flatMap((id) =>
    duplicates.has(id) ? [] : results.filter((r) => r.ruleId === id),
  );
  // Reassign scan-local sample ordinals in canonical rule order, independent of raw rule order.
  let referenceOrdinal = 0;
  for (const row of ordered)
    for (const sample of row.sampledReferences)
      sample.ordinal = referenceOrdinal++;
  if (ordered.length !== result.configuredRuleCount)
    reasons.add('INVALID_ENGINE_RESULT');
  result.results = ordered;
  result.mainDocumentEvaluated = ordered.length > 0;
  result.state = !ordered.length
    ? 'UNAVAILABLE'
    : reasons.size
      ? 'PARTIAL'
      : 'COMPLETE';
  if (!ordered.length) reasons.add('INVALID_ENGINE_RESULT');
  result.reasons = ACCESSIBILITY_REASONS.filter((r) => reasons.has(r));
  // Enforce the aggregate budget too: deep paths across many rules can exceed
  // it even when every individual array is within its own limit.
  if (JSON.stringify(result).length > LIMITS.serializedBytes) {
    reasons.add('RESULT_LIMIT_EXCEEDED');
    for (const row of ordered) {
      if (row.sampledReferences.length) {
        row.sampledReferences = [];
        row.samplesTruncated = true;
      }
    }
    result.state = 'PARTIAL';
    result.reasons = ACCESSIBILITY_REASONS.filter((r) => reasons.has(r));
  }
  const checked = projectAccessibilityAssessment(result);
  if (checked) return checked;
  // All fields were projected; a rejected envelope still never falls back to raw.
  return envelope();
}
