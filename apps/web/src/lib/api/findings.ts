import {
  FINDINGS_PAGE_MAX,
  projectPublicFinding,
  type PublicFinding,
  type FindingListResponse,
} from "@reactpulse/contracts";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
/** Public responses carry ruleVersion in the envelope; the durable projector
 * expects it in evidence. Adapt only that representation, never trust raw prose.
 * Evidence version remains independently validated by the category contract. */
export function projectFindingResponse(value: unknown): PublicFinding | null {
  try {
    const r = record(value), evidence = record(r.evidence);
    if (evidence.ruleVersion !== undefined && evidence.ruleVersion !== r.ruleVersion) return null;
    const safe = projectPublicFinding({ ...r, evidence: { ...evidence, ruleVersion: r.ruleVersion } });
    if (!safe || JSON.stringify(safe.affectedResource) !== JSON.stringify(r.affectedResource)) return null;
    return safe;
  } catch { return null; }
}
export function projectFindingListResponse(value: unknown, limit: number): FindingListResponse | null {
  try {
    const r = record(value);
    if (!Array.isArray(r.items) || r.items.length > Math.min(limit, FINDINGS_PAGE_MAX) ||
        !(r.nextCursor === null || validFindingCursor(r.nextCursor))) return null;
    const items: PublicFinding[] = [];
    for (const row of r.items) {
      const safe = projectFindingResponse(row);
      if (!safe || items.some(item => item.id === safe.id)) return null;
      items.push(safe);
    }
    if (r.nextCursor !== null && items.length !== limit) return null;
    return { items, nextCursor: r.nextCursor as string | null };
  } catch { return null; }
}
/** Match the API's timestamp/UUID cursor format, without using it as authority. */
export function validFindingCursor(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(value)) return false;
  try {
    const v: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'string' || typeof v[1] !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v[1])) return false;
    const d = new Date(v[0]); return Number.isFinite(d.getTime()) && d.toISOString() === v[0];
  } catch { return false; }
}
