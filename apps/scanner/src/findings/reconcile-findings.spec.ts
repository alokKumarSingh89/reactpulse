import { describe, expect, it } from 'vitest';
import type { Prisma } from '@reactpulse/database';
import type { DatabaseService } from '../database/database.service';
import { DeterministicFindingService } from './deterministic-finding.service';
import { reconcileFindings } from './reconcile-findings';
import { evaluatePerformanceFindings } from '../performance/performance-findings';
import { evaluateNetworkFindings } from '../network/network-findings';

function setup() {
  let rows: Prisma.FindingCreateManyInput[] = [];
  let fail = false;
  type Where = {
    scanId: string;
    category: string;
    fingerprint?: string | { notIn: string[] };
  };
  const matches = (r: Prisma.FindingCreateManyInput, w: Where) =>
    r.scanId === w.scanId &&
    r.category === w.category &&
    (typeof w.fingerprint === 'string'
      ? r.fingerprint === w.fingerprint
      : w.fingerprint
        ? !w.fingerprint.notIn.includes(r.fingerprint)
        : true);
  const writes: unknown[] = [];
  const tx = {
    finding: {
      findMany: async ({ where }: { where: Where }) =>
        rows.filter((r) => matches(r, where)),
      updateMany: async ({
        where,
        data,
      }: {
        where: Where;
        data: Partial<Prisma.FindingCreateManyInput>;
      }) => {
        writes.push(data);
        rows = rows.map((r) => (matches(r, where) ? { ...r, ...data } : r));
      },
      createMany: async ({
        data,
      }: {
        data: Prisma.FindingCreateManyInput[];
      }) => {
        for (const r of data) {
          if (
            rows.some(
              (old) =>
                old.scanId === r.scanId && old.fingerprint === r.fingerprint,
            )
          )
            throw new Error('Unique constraint');
          rows.push(r);
        }
      },
      deleteMany: async ({ where }: { where: Where }) => {
        rows = rows.filter((r) => !matches(r, where));
        if (fail) throw new Error('write failed');
      },
    },
  };
  const transaction = async (
    fn: (t: Prisma.TransactionClient) => Promise<void>,
  ) => {
    const saved = structuredClone(rows);
    try {
      await fn(tx as unknown as Prisma.TransactionClient);
    } catch (error) {
      rows = saved;
      throw error;
    }
  };
  return {
    service: new DeterministicFindingService({
      client: { $transaction: transaction },
    } as unknown as DatabaseService),
    rows: () => rows,
    seed: (value: Prisma.FindingCreateManyInput[]) => {
      rows = value;
    },
    fail: () => {
      fail = true;
    },
    transaction,
    writes,
  };
}
const performance = () =>
  evaluatePerformanceFindings({ lcpMs: 3000, cls: 0.2 });
const network = () =>
  evaluateNetworkFindings({
    failures: [
      {
        sequence: 0,
        requestSequence: 0,
        url: 'https://example.com',
        method: 'GET',
        resourceType: 'fetch',
        domain: 'example.com',
        party: 'FIRST_PARTY',
        failureText: null,
      },
    ],
  });

describe('category reconciliation integration', () => {
  it.each([
    'OPEN',
    'ACKNOWLEDGED',
    'RESOLVED',
    'IGNORED',
    'REGRESSION',
  ] as const)('preserves %s while updating scanner fields', async (status) => {
    const h = setup();
    await h.service.replaceForScan('scan', 'PERFORMANCE', performance());
    h.seed(
      h
        .rows()
        .map((r) => ({
          ...r,
          status,
          id: r.fingerprint,
          firstDetectedAt: new Date(0),
        })),
    );
    const changed = evaluatePerformanceFindings({ lcpMs: 3500, cls: 0.3 });
    await h.service.replaceForScan('scan', 'PERFORMANCE', changed);
    expect(
      h.rows().every((r) => r.status === status && r.id === r.fingerprint),
    ).toBe(true);
    expect(
      h.rows().find((r) => r.ruleId.includes('.lcp.'))?.evidence,
    ).toMatchObject({ measuredValue: 3500, ruleVersion: 1 });
    for (const data of h.writes) expect(data).not.toHaveProperty('status');
    const before = structuredClone(h.rows());
    await h.service.replaceForScan('scan', 'PERFORMANCE', changed);
    expect(h.rows()).toEqual(before);
  });
  it('A/B/C to A/C, then empty; isolates all categories and scans', async () => {
    const h = setup();
    await h.service.replaceForScan('scan', 'PERFORMANCE', performance());
    const base = h.rows()[0];
    const retained = ['SECURITY', 'ACCESSIBILITY', 'NETWORK', 'RESOURCE'].map(
      (category, i) => ({
        ...base,
        category: category as Prisma.FindingCreateManyInput['category'],
        fingerprint: String(i + 1).repeat(64),
        status: 'IGNORED' as const,
      }),
    );
    h.seed([
      ...h.rows(),
      ...retained,
      { ...base, scanId: 'other', status: 'IGNORED' },
      { ...base, fingerprint: 'f'.repeat(64), status: 'ACKNOWLEDGED' },
    ]);
    await h.service.replaceForScan('scan', 'PERFORMANCE', performance());
    expect(h.rows().some((r) => r.fingerprint === 'f'.repeat(64))).toBe(false);
    expect(
      h
        .rows()
        .filter((r) => r.scanId === 'scan' && r.category === 'PERFORMANCE'),
    ).toHaveLength(2);
    await h.service.replaceForScan('scan', 'PERFORMANCE', []);
    expect(h.rows()).toEqual([
      ...retained,
      { ...base, scanId: 'other', status: 'IGNORED' },
    ]);
  });
  it('new fingerprints and new scans start OPEN, without lifecycle inheritance', async () => {
    const h = setup();
    await h.service.replaceForScan(
      'scan',
      'PERFORMANCE',
      performance().slice(0, 1),
    );
    h.seed(h.rows().map((r) => ({ ...r, status: 'IGNORED' })));
    await h.service.replaceForScan('scan', 'PERFORMANCE', performance());
    expect(
      h
        .rows()
        .map((r) => r.status)
        .sort((a, b) => String(a).localeCompare(String(b))),
    ).toEqual(['IGNORED', 'OPEN']);
    await h.service.replaceForScan('new', 'PERFORMANCE', performance());
    expect(
      h
        .rows()
        .filter((r) => r.scanId === 'new')
        .every((r) => r.status === 'OPEN'),
    ).toBe(true);
  });
  it('deduplicates identical candidates, rejects conflicts and category mismatch', async () => {
    const h = setup();
    const [a] = performance();
    await h.service.replaceForScan('scan', 'PERFORMANCE', [a, a]);
    expect(h.rows()).toHaveLength(1);
    const changed = evaluatePerformanceFindings({ lcpMs: 3500 })[0];
    await expect(
      h.service.replaceForScan('scan', 'PERFORMANCE', [a, changed]),
    ).rejects.toThrow('Conflicting');
    await expect(
      h.service.replaceForScan('scan', 'NETWORK', [a]),
    ).rejects.toThrow('Invalid');
    expect(h.rows()).toHaveLength(1);
  });
  it('rolls back updates, additions and removals on persistence failure', async () => {
    const h = setup();
    await h.service.replaceForScan('scan', 'PERFORMANCE', performance());
    h.seed(h.rows().map((r) => ({ ...r, status: 'RESOLVED' })));
    const before = structuredClone(h.rows());
    h.fail();
    await expect(
      h.service.replaceForScan(
        'scan',
        'PERFORMANCE',
        evaluatePerformanceFindings({ lcpMs: 4000 }),
      ),
    ).rejects.toThrow('write failed');
    expect(h.rows()).toEqual(before);
  });
  it('respects actual scan/fingerprint uniqueness across categories', async () => {
    const h = setup();
    await h.service.replaceForScan('scan', 'PERFORMANCE', performance());
    const old = structuredClone(h.rows());
    const collision = { ...h.rows()[0], category: 'NETWORK' as const };
    await expect(
      h.transaction((tx) =>
        reconcileFindings(tx, 'scan', 'NETWORK', [collision]),
      ),
    ).rejects.toThrow('Unique');
    expect(h.rows()).toEqual(old);
  });
  it('projects safe performance/network inputs before durable mapping', async () => {
    const h = setup();
    const canaries = [
      'persistence-email-canary@example.com',
      'persistence-token-canary-9182',
      'persistence-query-secret-7712',
      'persistence-dom-secret-6631',
    ];
    for (const f of [...performance(), ...network()]) {
      Object.assign(f, {
        title: canaries[0],
        recommendation: canaries[1],
        url: canaries[2],
      });
      Object.assign(f.evidence, { html: canaries[3], headers: canaries });
      await h.service.replaceForScan('scan', f.category, [f]);
    }
    for (const c of canaries) expect(JSON.stringify(h.rows())).not.toContain(c);
    expect(h.rows().every((r) => r.status === 'OPEN')).toBe(true);
    expect(h.rows().some((r) => r.category === 'RESOURCE')).toBe(false);
  });
});
