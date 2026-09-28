import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@reactpulse/database';
import type { DatabaseService } from '../database/database.service';
import { SecurityFindingService } from './security-finding.service';
import type {
  SecurityRuleEvaluation,
  SecurityRuleResult,
} from './security-rules';

function result(cookie = false): SecurityRuleResult {
  return cookie
    ? {
        ruleId: 'security.cookie.secure-missing',
        ruleVersion: 1,
        outcome: 'POSTURE',
        severity: 'LOW',
        confidence: 'MEDIUM',
        reason: 'COOKIE_SECURE_ABSENT',
        evidence: {
          source: 'cookies',
          subject: {
            kind: 'COOKIE',
            documentResponseOrdinal: 0,
            cookieOrdinal: 1,
          },
        },
      }
    : {
        ruleId: 'security.transport.insecure-final',
        ruleVersion: 1,
        outcome: 'POSTURE',
        severity: 'MEDIUM',
        confidence: 'HIGH',
        reason: 'HTTP_FINAL_OBSERVED',
        evidence: { source: 'navigation', subject: { kind: 'MAIN_DOCUMENT' } },
      };
}
function evaluation(results: SecurityRuleResult[]): SecurityRuleEvaluation {
  return {
    coverage: {
      version: 1,
      rulesetVersion: 1,
      state: 'PARTIAL',
      reasons: ['NETWORK_OBSERVATION_UNAVAILABLE'],
    },
    results,
  };
}
function setup() {
  let rows: Prisma.FindingCreateManyInput[] = [];
  const markers = new Map<string, unknown>();
  const createMany = vi.fn(
    async ({ data }: { data: Prisma.FindingCreateManyInput[] }) => {
      rows.push(...data);
    },
  );
  const deleteMany = vi.fn(
    async ({ where }: { where: { scanId: string; category: string; fingerprint?: { notIn: string[] } } }) => {
      rows = rows.filter(
        (r) => r.scanId !== where.scanId || r.category !== where.category || !!where.fingerprint?.notIn.includes(r.fingerprint),
      );
    },
  );
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
  const findMany = vi.fn(async ({ where }: { where: { scanId: string; category: string } }) =>
    rows.filter(r => r.scanId === where.scanId && r.category === where.category));
  const updateMany = vi.fn(async ({ where, data }: { where: { scanId: string; category: string; fingerprint: string }; data: Partial<Prisma.FindingCreateManyInput> }) => {
    rows = rows.map(r => r.scanId === where.scanId && r.category === where.category && r.fingerprint === where.fingerprint ? { ...r, ...data } : r);
  });
  const transaction = vi.fn(
    async (callback: (tx: unknown) => Promise<void>) => {
      const before = [...rows];
      const saved = new Map(markers);
      try {
        await callback({
          finding: { deleteMany, createMany, findMany, updateMany },
          scanEvidence: { upsert, deleteMany: removeMarker },
        });
      } catch (error) {
        rows = before;
        markers.clear();
        saved.forEach((value, key) => markers.set(key, value));
        throw error;
      }
    },
  );
  const database = {
    client: { $transaction: transaction },
  } as unknown as DatabaseService;
  return {
    service: new SecurityFindingService(database),
    rows: () => rows,
    seed: (data: Prisma.FindingCreateManyInput[]) => {
      rows = data;
    },
    markers,
    createMany,
    updateMany,
    deleteMany,
    upsert,
    removeMarker,
    transaction,
  };
}

describe('SecurityFindingService', () => {
  it('projects fixed content, existing enums, safe references and no secret canaries', async () => {
    const h = setup();
    const input = evaluation([result(), result(true)]);
    const secret = 'persistence-email-canary@example.com persistence-token-canary-9182 persistence-query-secret-7712 persistence-dom-secret-6631 findings-email-canary@example.com findings-token-canary-9182 findings-input-secret-7712 findings-dom-secret-6631 findings-url-secret-5520 authorization-secret-canary-9f31_cookie-secret-canary-8ab2_query-secret-canary-74ce_nonce-secret-canary-27aa_console-secret-canary-13ef_filesystem-secret-canary-02dc';
    Object.assign(input, { headers: { authorization: secret }, url: secret });
    Object.assign(input.coverage, {
      extra: secret,
      reasons: [...input.coverage.reasons, secret],
    });
    for (const row of input.results) {
      Object.assign(row, {
        title: secret,
        description: secret,
        recommendation: secret,
        affectedUrl: secret,
      });
      Object.assign(row.evidence, {
        headers: secret,
        cookieName: secret,
        cookieValue: secret,
        nonce: secret,
        console: secret,
      });
      Object.assign(row.evidence.subject, { url: secret, name: secret });
    }
    await h.service.replaceForScan('scan', input);
    expect(h.rows()[0]).toMatchObject({
      scanId: 'scan',
      category: 'SECURITY',
      status: 'OPEN',
      severity: 'MEDIUM',
      confidence: 'HIGH',
      title: 'Final document used HTTP',
      description:
        'The observed final document used unencrypted HTTP transport.',
      recommendation:
        'Serve the application over HTTPS and review entry-point redirects.',
      affectedUrl: null,
      affectedResource: 'main-document',
      evidence: {
        version: 1,
        ruleVersion: 1,
        outcome: 'POSTURE',
        reason: 'HTTP_FINAL_OBSERVED',
        source: 'navigation',
        subject: { kind: 'MAIN_DOCUMENT' },
      },
    });
    expect(h.rows()[1]).toMatchObject({
      affectedResource: 'document:0:cookie:1',
      severity: 'LOW',
      confidence: 'MEDIUM',
    });
    expect(
      JSON.stringify([h.createMany.mock.calls, h.upsert.mock.calls]),
    ).not.toContain(secret);
    for (const canary of secret.split(' ').slice(0, 5)) {
      expect(JSON.stringify(h.createMany.mock.calls)).not.toContain(canary);
    }
    expect(h.rows().map(row => row.fingerprint)).toEqual([
      '954b1c3a489442ced5ce27a5fa707a7d527c23aaab9fcdaba40607509e4b7be4',
      'a60dcc2fe240fc771c13b96e595671acdd5bcd6e8b7f6cdb75406a6853635a1c',
    ]);
    expect(h.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { scanId: 'scan', category: 'SECURITY', fingerprint: { notIn: h.rows().map(r => r.fingerprint).sort() } },
    });
  });
  it('has stable fingerprints across retries and separates rules and subjects', async () => {
    const h = setup();
    const input = evaluation([result(), result(true)]);
    await h.service.replaceForScan('scan', input);
    const first = h.rows().map((r) => r.fingerprint);
    await h.service.replaceForScan('scan', input);
    expect(h.rows().map((r) => r.fingerprint)).toEqual(first);
    expect(new Set(first).size).toBe(2);
    const other = result(true);
    other.evidence.subject = {
      kind: 'COOKIE',
      documentResponseOrdinal: 0,
      cookieOrdinal: 2,
    };
    await h.service.replaceForScan('scan', evaluation([other]));
    expect(first).not.toContain(h.rows()[0].fingerprint);
  });
  it('replaces A,B with A then zero, retaining assessment and other categories/scans', async () => {
    const h = setup();
    await h.service.replaceForScan(
      'scan',
      evaluation([result(), result(true)]),
    );
    const base = h.rows()[0];
    h.seed([
      ...h.rows(),
      { ...base, category: 'PERFORMANCE', fingerprint: 'perf' },
      { ...base, category: 'NETWORK', fingerprint: 'network' },
      { ...base, category: 'ACCESSIBILITY', fingerprint: 'a11y' },
      { ...base, scanId: 'other' },
    ]);
    await h.service.replaceForScan('scan', evaluation([result()]));
    expect(
      h.rows().filter((r) => r.scanId === 'scan' && r.category === 'SECURITY'),
    ).toHaveLength(1);
    await h.service.replaceForScan('scan', evaluation([]));
    expect(h.rows().map((r) => [r.scanId, r.category])).toEqual([
      ['scan', 'PERFORMANCE'],
      ['scan', 'NETWORK'],
      ['scan', 'ACCESSIBILITY'],
      ['other', 'SECURITY'],
    ]);
    expect(h.markers.get('scan')).toEqual({
      kind: 'PASSIVE_SECURITY_ASSESSMENT',
      coverage: evaluation([]).coverage,
    });
    expect(h.removeMarker).not.toHaveBeenCalled();
  });
  it.each(['COMPLETE', 'PARTIAL', 'UNAVAILABLE'] as const)(
    'preserves %s assessment with zero findings',
    async (state) => {
      const h = setup();
      const input = evaluation([]);
      input.coverage.state = state;
      await h.service.replaceForScan('scan', input);
      expect(h.createMany).not.toHaveBeenCalled();
      expect(h.markers.get('scan')).toMatchObject({ coverage: { state } });
    },
  );
  it.each(['OBSERVED', 'UNCERTAIN', 'NOT_ASSESSED', 'NOT_APPLICABLE'] as const)(
    'does not persist %s results as findings',
    async (outcome) => {
      const h = setup();
      await h.service.replaceForScan(
        'scan',
        evaluation([{ ...result(), outcome, severity: null }]),
      );
      expect(h.rows()).toEqual([]);
      expect(h.markers.has('scan')).toBe(true);
    },
  );
  it('clears stale findings/marker when the browser supplied no assessment', async () => {
    const h = setup();
    await h.service.replaceForScan('scan', evaluation([result()]));
    await h.service.replaceForScan('scan', null);
    expect(h.rows()).toEqual([]);
    expect(h.markers.has('scan')).toBe(false);
    expect(h.removeMarker).toHaveBeenCalledWith({
      where: { scanId: 'scan', type: 'DOCUMENT_RESPONSE', sequence: 1 },
    });
  });
  it.each(['create', 'marker'] as const)(
    'propagates %s failure and rolls back replacement',
    async (stage) => {
      const h = setup();
      await h.service.replaceForScan('scan', evaluation([result()]));
      const before = [...h.rows()];
      const marker = h.markers.get('scan');
      if (stage === 'create')
        h.createMany.mockRejectedValueOnce(new Error('write failed'));
      else h.upsert.mockRejectedValueOnce(new Error('write failed'));
      await expect(
        h.service.replaceForScan('scan', evaluation([result(true)])),
      ).rejects.toThrow('write failed');
      expect(h.rows()).toEqual(before);
      expect(h.markers.get('scan')).toEqual(marker);
    },
  );
  it('rejects malformed reportable results before opening a transaction', async () => {
    const h = setup();
    const row = result(true);
    row.evidence.subject = {
      kind: 'COOKIE',
      documentResponseOrdinal: 0,
      cookieOrdinal: -1,
    };
    await expect(
      h.service.replaceForScan('scan', evaluation([row])),
    ).rejects.toThrow('Invalid security finding subject');
    expect(h.transaction).not.toHaveBeenCalled();
    const unsafe = {
      ...result(),
      reason: 'SECRET_CANARY',
    } as unknown as SecurityRuleResult;
    await expect(
      h.service.replaceForScan('scan', evaluation([unsafe])),
    ).rejects.toThrow('Invalid security finding result');
    expect(h.transaction).not.toHaveBeenCalled();
  });
  it('deduplicates the same reportable rule and subject', async () => {
    const h = setup();
    await h.service.replaceForScan('scan', evaluation([result(), result()]));
    expect(h.rows()).toHaveLength(1);
  });
});

it.each(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED', 'REGRESSION'] as const)('preserves same-scan %s on category retry', async status => {
  const h = setup();
  await h.service.replaceForScan('scan', evaluation([result()]));
  h.seed(h.rows().map(r => ({ ...r, status })));
  await h.service.replaceForScan('scan', evaluation([result()]));
  expect(h.rows().every(r => r.status === status)).toBe(true);
});
