import type { Prisma } from '@reactpulse/database';

export type ReconciledCategory =
  'SECURITY' | 'ACCESSIBILITY' | 'PERFORMANCE' | 'NETWORK';
/** Only category-projected fields enter this low-level boundary. Lifecycle,
 * source correlation and identity timestamps deliberately are not update data. */
export type ProjectedFindingRow = Pick<
  Prisma.FindingCreateManyInput,
  | 'scanId'
  | 'category'
  | 'ruleId'
  | 'fingerprint'
  | 'severity'
  | 'confidence'
  | 'title'
  | 'description'
  | 'recommendation'
  | 'affectedUrl'
  | 'affectedResource'
  | 'evidence'
>;

export async function reconcileFindings(
  tx: Pick<Prisma.TransactionClient, 'finding'>,
  scanId: string,
  category: ReconciledCategory,
  candidates: readonly ProjectedFindingRow[],
): Promise<void> {
  const rows = new Map<string, ProjectedFindingRow>();
  for (const candidate of candidates) {
    if (
      candidate.scanId !== scanId ||
      candidate.category !== category ||
      !/^[a-f0-9]{64}$/.test(candidate.fingerprint)
    )
      throw new Error('Invalid projected finding');
    // Explicit projection excludes lifecycle properties even for legacy callers.
    const row: ProjectedFindingRow = {
      scanId,
      category,
      fingerprint: candidate.fingerprint,
      ruleId: candidate.ruleId,
      severity: candidate.severity,
      confidence: candidate.confidence,
      title: candidate.title,
      description: candidate.description,
      recommendation: candidate.recommendation,
      affectedUrl: candidate.affectedUrl,
      affectedResource: candidate.affectedResource,
      evidence: candidate.evidence,
    };
    const previous = rows.get(row.fingerprint);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row))
      throw new Error('Conflicting finding candidates');
    rows.set(row.fingerprint, row);
  }
  const ordered = [...rows.values()].sort((a, b) =>
    a.fingerprint < b.fingerprint ? -1 : a.fingerprint > b.fingerprint ? 1 : 0,
  );
  const existing = await tx.finding.findMany({
    where: { scanId, category },
    select: { fingerprint: true },
  });
  const fingerprints = new Set(existing.map((row) => row.fingerprint));
  for (const row of ordered) {
    if (fingerprints.has(row.fingerprint)) {
      // Never spread create data (status OPEN) into an update. Preserve status,
      // row ID, firstDetectedAt and other lifecycle-owned metadata in place.
      await tx.finding.updateMany({
        where: { scanId, category, fingerprint: row.fingerprint },
        data: {
          ruleId: row.ruleId,
          severity: row.severity,
          confidence: row.confidence,
          title: row.title,
          description: row.description,
          recommendation: row.recommendation,
          affectedUrl: row.affectedUrl,
          affectedResource: row.affectedResource,
          evidence: row.evidence,
        },
      });
    }
  }
  const additions = ordered.filter((row) => !fingerprints.has(row.fingerprint));
  if (additions.length)
    await tx.finding.createMany({
      data: additions.map((row) => ({ ...row, status: 'OPEN' })),
    });
  await tx.finding.deleteMany({
    where: {
      scanId,
      category,
      fingerprint: { notIn: ordered.map((row) => row.fingerprint) },
    },
  });
}
