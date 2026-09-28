import type { AccessibilityAssessment } from '@reactpulse/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@reactpulse/database';
import type { DatabaseService } from '../database/database.service';
import type { AccessibilityObservation } from './accessibility-observation.service';
import { AccessibilityFindingService } from './accessibility-finding.service';
import { mapAccessibilityFindings } from './accessibility-finding-mapper';
import { projectAccessibilityObservation } from './accessibility-projector';

const canaries = [
  'persistence-email-canary@example.com', 'persistence-token-canary-9182', 'persistence-query-secret-7712', 'persistence-dom-secret-6631',
  'accessibility-email-canary@example.com',
  'accessibility-token-canary-9182',
  'accessibility-input-secret-7712',
  'accessibility-dom-text-secret-6631',
  'accessibility-id-secret-5520',
];
function candidates() {
  const secret = canaries.join(' ');
  return mapAccessibilityFindings(
    projectAccessibilityObservation({
      engine: 'axe-core',
      engineVersion: '4.13.0',
      rulesetVersion: 1,
      scope: 'MAIN_DOCUMENT',
      durationMs: 1,
      excludedFrameCount: 0,
      state: 'SUCCEEDED',
      raw: {
        violations: ['label', 'image-alt', 'button-name'].map((id) => ({
          id,
          impact: 'serious',
          tags: ['wcag2a'],
          help: secret,
          nodes: [
            {
              html: secret,
              target: [secret],
              failureSummary: secret,
              value: secret,
            },
          ],
        })),
        passes: [],
        incomplete: [],
        inapplicable: [],
        url: secret,
        error: secret,
      },
    }),
  );
}
function assessment(
  state: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE' = 'COMPLETE',
): AccessibilityAssessment {
  return {
    version: 1,
    state,
    scope: 'MAIN_DOCUMENT',
    engine: {
      name: 'axe-core',
      version: '4.13.0',
      rulesetVersion: 1,
      profileId: 'main-document-v1',
    },
    mainDocumentEvaluated: state !== 'UNAVAILABLE',
    excludedFrameCount: 0,
    durationMs: 10,
    configuredRuleCount: 1,
    reasons:
      state === 'COMPLETE'
        ? []
        : [state === 'PARTIAL' ? 'REFERENCE_UNAVAILABLE' : 'ENGINE_TIMEOUT'],
    results:
      state === 'UNAVAILABLE'
        ? []
        : [
            {
              ruleId: 'label',
              ruleVersion: 1,
              outcome: 'INAPPLICABLE',
              engineImpact: 'UNKNOWN',
              occurrenceCount: 0,
              countPrecision: 'EXACT',
              samplesTruncated: false,
              sampledReferences: [],
              wcagTags: [],
              wcagCriteria: [],
            },
          ],
  };
}
function setup() {
  const markers = new Map<string, unknown>();
  const upsert = vi.fn(
    async ({ create }: { create: { scanId: string; data: unknown } }) => {
      markers.set(create.scanId, create.data);
    },
  );
  const removeMarker = vi.fn(
    async ({ where }: { where: { scanId: string } }) => {
      markers.delete(where.scanId);
    },
  );
  let failCommit = false;
  let rows: Prisma.FindingCreateManyInput[] = [];
  const deleteMany = vi.fn(
    async ({ where }: { where: { scanId: string; category: string; fingerprint?: { notIn: string[] } } }) => {
      rows = rows.filter(
        (r) => r.scanId !== where.scanId || r.category !== where.category || !!where.fingerprint?.notIn.includes(r.fingerprint),
      );
    },
  );
  const createMany = vi.fn(
    async ({ data }: { data: Prisma.FindingCreateManyInput[] }) => {
      rows.push(...data);
    },
  );
  const findMany = vi.fn(async ({ where }: { where: { scanId: string; category: string } }) =>
    rows.filter(r => r.scanId === where.scanId && r.category === where.category));
  const updateMany = vi.fn(async ({ where, data }: { where: { scanId: string; category: string; fingerprint: string }; data: Partial<Prisma.FindingCreateManyInput> }) => {
    rows = rows.map(r => r.scanId === where.scanId && r.category === where.category && r.fingerprint === where.fingerprint ? { ...r, ...data } : r);
  });
  const transaction = vi.fn(
    async (callback: (tx: unknown) => Promise<void>) => {
      const before = rows.slice();
      const saved = new Map(markers);
      try {
        await callback({
          finding: { deleteMany, createMany, findMany, updateMany },
          scanEvidence: { upsert, deleteMany: removeMarker },
        });
        if (failCommit) throw new Error('commit failed');
      } catch (error) {
        rows = before;
        markers.clear();
        saved.forEach((value, key) => markers.set(key, value));
        throw error;
      }
    },
  );
  return {
    service: new AccessibilityFindingService({
      client: { $transaction: transaction },
    } as unknown as DatabaseService),
    markers,
    upsert,
    removeMarker,
    failCommit: () => {
      failCommit = true;
    },
    rows: () => rows,
    seed: (data: Prisma.FindingCreateManyInput[]) => {
      rows = data;
    },
    transaction,
    deleteMany,
    updateMany,
    createMany,
  };
}

describe('AccessibilityFindingService', () => {
  it('reconciles A/B/C to A/C to zero, preserving other categories and scans', async () => {
    const h = setup();
    const [a, b, c] = candidates();
    await h.service.replaceForScan('scan', [a, b, c], assessment());
    expect(h.rows()).toHaveLength(3);
    const base = h.rows()[0];
    const retained: Prisma.FindingCreateManyInput[] = [
      { ...base, category: 'SECURITY', fingerprint: 'S1' },
      { ...base, category: 'SECURITY', fingerprint: 'S2' },
      { ...base, category: 'PERFORMANCE', fingerprint: 'P1' },
      { ...base, category: 'NETWORK', fingerprint: 'N1' },
      { ...base, category: 'RESOURCE', fingerprint: 'R1' },
      { ...base, scanId: 'other' },
    ];
    h.seed([...h.rows(), ...retained]);
    await h.service.replaceForScan('scan', [a, c], assessment());
    expect(
      h
        .rows()
        .filter((r) => r.scanId === 'scan' && r.category === 'ACCESSIBILITY')
        .map((r) => r.fingerprint)
        .sort(),
    ).toEqual([a.fingerprint, c.fingerprint].sort());
    await h.service.replaceForScan('scan', [], assessment());
    expect(h.rows()).toEqual(retained);
    expect(h.deleteMany).toHaveBeenLastCalledWith({
      where: { scanId: 'scan', category: 'ACCESSIBILITY', fingerprint: { notIn: [] } },
    });
    expect(h.transaction).toHaveBeenCalledTimes(3);
    expect(h.createMany).toHaveBeenCalledTimes(1);
  });

  it('is logically idempotent, order independent and deduplicates identical candidates', async () => {
    const h = setup();
    const input = candidates();
    await h.service.replaceForScan('scan', input, assessment());
    const first = h.rows();
    await h.service.replaceForScan('scan', input, assessment());
    expect(h.rows()).toEqual(first);
    await h.service.replaceForScan('scan', [...input].reverse(), assessment());
    expect(h.rows()).toEqual(first);
    await h.service.replaceForScan('scan', [...input, input[0]], assessment());
    expect(h.rows()).toEqual(first);
  });

  it('persists original fingerprints, catalog prose and safe evidence without raw canaries', async () => {
    const h = setup();
    const input = candidates();
    const secret = canaries.join(' ');
    for (const candidate of input) {
      Object.assign(candidate, { raw: secret, metadata: secret });
      Object.assign(candidate.evidence, {
        html: secret,
        headers: secret,
        error: secret,
      });
    }
    await h.service.replaceForScan('scan', input, assessment());
    for (const candidate of input) {
      const row = h.rows().find((r) => r.fingerprint === candidate.fingerprint);
      expect(row).toMatchObject({
        scanId: 'scan',
        category: 'ACCESSIBILITY',
        status: 'OPEN',
        title: candidate.title,
        description: candidate.description,
        recommendation: candidate.recommendation,
        affectedUrl: null,
        affectedResource: 'main-document',
        evidence: {
          ruleId: candidate.evidence.ruleId,
          occurrenceCount: 1,
          wcagTags: ['wcag2a'],
        },
      });
    }
    for (const secret of canaries)
      expect(JSON.stringify(h.createMany.mock.calls)).not.toContain(secret);
  });

  it('projects bounded structural samples without unexpected node or path properties', async () => {
    const h = setup();
    const input = candidates();
    const secret = canaries.join(' ');
    input[0].evidence.sampledReferences = [
      {
        ordinal: 0,
        tag: 'input',
        role: 'textbox',
        path: [{ tag: 'main', index: 0 }],
      },
    ];
    Object.assign(input[0].evidence.sampledReferences[0], {
      html: secret,
      target: [secret],
      id: secret,
    });
    Object.assign(input[0].evidence.sampledReferences[0].path![0], {
      class: secret,
    });
    await h.service.replaceForScan('scan', input, assessment());
    const persisted = h
      .rows()
      .find((row) => row.fingerprint === input[0].fingerprint);
    expect(persisted?.evidence).toMatchObject({
      sampledReferences: [
        {
          ordinal: 0,
          tag: 'input',
          role: 'textbox',
          path: [{ tag: 'main', index: 0 }],
        },
      ],
    });
    for (const canary of canaries)
      expect(JSON.stringify(h.createMany.mock.calls)).not.toContain(canary);
  });

  it('clears stale findings for an authoritative engine-unavailable evaluation', async () => {
    const h = setup();
    await h.service.replaceForScan('scan', candidates(), assessment());
    const unavailable = projectAccessibilityObservation({
      engine: 'axe-core',
      engineVersion: '4.13.0',
      rulesetVersion: 1,
      scope: 'MAIN_DOCUMENT',
      durationMs: 10,
      excludedFrameCount: 0,
      state: 'UNAVAILABLE',
      reason: 'ENGINE_TIMEOUT',
    });
    await h.service.replaceForScan(
      'scan',
      mapAccessibilityFindings(unavailable),
      unavailable,
    );
    expect(h.rows()).toEqual([]);
  });

  it('rolls back replacement when insertion fails', async () => {
    const h = setup();
    const input = candidates();
    await h.service.replaceForScan('scan', input, assessment());
    const before = h.rows();
    h.createMany.mockRejectedValueOnce(new Error('write failed'));
      h.updateMany.mockRejectedValueOnce(new Error('write failed'));
    await expect(
      h.service.replaceForScan('scan', [input[0]], assessment()),
    ).rejects.toThrow('write failed');
    expect(h.rows()).toEqual(before);
  });

  it.each(['prose', 'reference', 'fingerprint', 'conflict'] as const)(
    'rejects unsafe %s before opening a transaction',
    async (kind) => {
      const h = setup();
      const input = candidates();
      if (kind === 'prose') input[0].description = canaries[0];
      if (kind === 'reference')
        Object.assign(input[0].evidence, {
          sampledReferences: [
            { ordinal: 0, tag: canaries[1], role: 'textbox', path: null },
          ],
        });
      if (kind === 'fingerprint') input[0].fingerprint = canaries[2];
      if (kind === 'conflict') input[1].fingerprint = input[0].fingerprint;
      await expect(
        h.service.replaceForScan('scan', input, assessment()),
      ).rejects.toThrow('Invalid accessibility finding candidate');
      expect(h.transaction).not.toHaveBeenCalled();
    },
  );
});

// Compile-time assertion: transient engine output cannot enter persistence.
function rawOutputIsNotAccepted(
  service: AccessibilityFindingService,
  raw: AccessibilityObservation,
) {
  // @ts-expect-error Only mapper candidates, never raw engine observations.
  return service.replaceForScan('scan', [raw], assessment());
}
void rawOutputIsNotAccepted;

describe('durable accessibility assessment', () => {
  it('distinguishes legacy absence from COMPLETE zero and replaces rather than accumulating markers', async () => {
    const h = setup();
    expect(h.markers.size).toBe(0);
    await h.service.replaceForScan('scan', [], assessment());
    expect(h.markers.get('scan')).toMatchObject({
      kind: 'ACCESSIBILITY_ASSESSMENT',
      version: 1,
      assessment: { version: 1, state: 'COMPLETE' },
    });
    expect(h.rows()).toEqual([]);
    await h.service.replaceForScan('scan', candidates(), assessment('PARTIAL'));
    expect(h.markers.size).toBe(1);
    expect(h.markers.get('scan')).toMatchObject({
      assessment: { state: 'PARTIAL' },
    });
    await h.service.replaceForScan('scan', [], assessment('UNAVAILABLE'));
    expect(h.rows()).toEqual([]);
    expect(h.markers.get('scan')).toMatchObject({
      assessment: { state: 'UNAVAILABLE', reasons: ['ENGINE_TIMEOUT'] },
    });
    await h.service.replaceForScan('scan', [], null);
    expect(h.markers.size).toBe(0);
    expect(h.removeMarker).toHaveBeenLastCalledWith({
      where: { scanId: 'scan', type: 'DOCUMENT_RESPONSE', sequence: 2 },
    });
  });
  it.each(['marker', 'finding', 'commit'] as const)(
    'rolls back both sides on %s failure',
    async (stage) => {
      const h = setup();
      await h.service.replaceForScan('scan', candidates(), assessment());
      const before = h.rows();
      const marker = h.markers.get('scan');
      if (stage === 'marker')
        h.upsert.mockRejectedValueOnce(new Error('write failed'));
      if (stage === 'finding')
        h.updateMany.mockRejectedValueOnce(new Error('write failed'));
      if (stage === 'commit') h.failCommit();
      await expect(
        h.service.replaceForScan(
          'scan',
          [candidates()[0]],
          assessment('PARTIAL'),
        ),
      ).rejects.toThrow();
      expect(h.rows()).toEqual(before);
      expect(h.markers.get('scan')).toEqual(marker);
    },
  );
  it('strips canaries from marker and rejects invalid assessment before writes', async () => {
    const h = setup();
    const safe = assessment();
    const secret = canaries.join(' ');
    Object.assign(safe, { raw: secret, error: secret, url: secret });
    Object.assign(safe.engine!, { stack: secret });
    await h.service.replaceForScan('scan', candidates(), safe);
    for (const canary of canaries)
      expect(
        JSON.stringify([h.upsert.mock.calls, h.createMany.mock.calls]),
      ).not.toContain(canary);
    Object.assign(safe, { reasons: [secret] });
    await expect(h.service.replaceForScan('scan', [], safe)).rejects.toThrow(
      'Invalid accessibility assessment',
    );
    expect(h.transaction).toHaveBeenCalledTimes(1);
  });
});

it.each(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED', 'REGRESSION'] as const)('preserves same-scan %s on category retry', async status => {
  const h = setup();
  await h.service.replaceForScan('scan', candidates(), assessment());
  h.seed(h.rows().map(r => ({ ...r, status })));
  await h.service.replaceForScan('scan', candidates(), assessment());
  expect(h.rows().every(r => r.status === status)).toBe(true);
});
