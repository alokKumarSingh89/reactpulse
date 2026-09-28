import type { DeterministicFindingService } from '../findings/deterministic-finding.service';
import type { AccessibilityFindingService } from '../accessibility/accessibility-finding.service';
import type { AccessibilityObservation } from '../accessibility/accessibility-observation.service';
import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import { SCAN_JOB, type ExecuteScanJob } from '@reactpulse/contracts';
import type { DatabaseService } from '../database/database.service';
import type { RedisService } from '../queue/redis.service';
import type { BrowserScannerService } from '../browser/browser-scanner.service';
import type { ScanEvidenceService } from '../evidence/scan-evidence.service';
import type { PerformanceMetricService } from '../performance/performance-metric.service';
import type { NetworkMetricService } from '../network/network-metric.service';
import type { SecurityFindingService } from '../security/security-finding.service';
import { observeSecurityHeaders } from '../security/security-observation.service';
import { ScanProcessor } from './scan.processor';

function setup(attemptsMade = 0, security = true) {
  const order: string[] = [];
  const scan = {
    id: 'scan',
    targetUrl: 'https://example.com/',
    status: 'QUEUED',
    startedAt: null,
  };
  const update = vi.fn(async ({ data }: { data: { status: string } }) => {
    order.push(data.status);
  });
  const headers = observeSecurityHeaders([], 0, false);
  const result = {
    accessibility: undefined as AccessibilityObservation | undefined,
    browser: { name: 'chromium', version: '1' },
    performance: { metrics: {} },
    network: { requests: [], responses: [], failures: [] },
    security: security
      ? {
          assessment: {
            ...headers,
            coverage: {
              version: 1,
              rulesetVersion: 1,
              state: 'PARTIAL',
              reasons: ['NETWORK_OBSERVATION_UNAVAILABLE'],
            },
            navigation: {
              state: 'OBSERVED',
              facts: {
                requestedScheme: 'HTTPS',
                finalScheme: 'HTTPS',
                requestedSite: null,
                finalSite: null,
                transportState: 'HTTPS_ONLY_OBSERVED',
              },
            },
            mainDocument: {
              state: 'OBSERVED',
              facts: { status: 200, mediaType: 'text/html', site: null },
            },
            mixedContent: {
              state: 'UNAVAILABLE',
              reason: 'NETWORK_OBSERVATION_UNAVAILABLE',
            },
          },
        }
      : undefined,
  };
  const step = (name: string) => ({
    replaceForScan: vi.fn(async () => {
      order.push(name);
    }),
  });
  const evidence = step('evidence'),
    performance = step('performance'),
    network = step('network'),
    findings = step('security'),
    accessibility = step('accessibility');
  const deterministic = { replaceForScan: vi.fn(async (_scanId: string, category: string, _candidates: unknown[]) => { order.push(category); }) };
  const processor = new ScanProcessor(
    {
      client: { scan: { findUnique: vi.fn().mockResolvedValue(scan), update } },
    } as unknown as DatabaseService,
    {} as RedisService,
    {
      scan: vi.fn(async () => {
        order.push('browser');
        return result;
      }),
    } as unknown as BrowserScannerService,
    evidence as unknown as ScanEvidenceService,
    performance as unknown as PerformanceMetricService,
    network as unknown as NetworkMetricService,
    findings as unknown as SecurityFindingService,
    accessibility as unknown as AccessibilityFindingService,
    deterministic as unknown as DeterministicFindingService,
  );
  // Exercise the job handler without starting a Redis worker.
  const run = () =>
    (
      processor as unknown as {
        processJob(job: Job<ExecuteScanJob>): Promise<void>;
      }
    ).processJob({
      name: SCAN_JOB,
      data: { scanId: 'scan' },
      attemptsMade,
      opts: { attempts: 2 },
    } as Job<ExecuteScanJob>);
  return { run, order, update, findings, accessibility, deterministic, result };
}

describe('security persistence orchestration', () => {
  it('evaluates safe observations and persists findings before completion', async () => {
    const h = setup();
    await h.run();
    expect(h.order).toEqual([
      'RUNNING',
      'browser',
      'evidence',
      'performance',
      'network',
      'security',
      'accessibility',
      'PERFORMANCE',
      'NETWORK',
      'COMPLETED',
    ]);
    expect(h.findings.replaceForScan).toHaveBeenCalledWith(
      'scan',
      expect.objectContaining({
        coverage: expect.objectContaining({ state: 'PARTIAL' }),
        results: expect.arrayContaining([
          expect.objectContaining({
            ruleId: 'security.csp.missing',
            outcome: 'POSTURE',
          }),
        ]),
      }),
    );
  });
  it.each([
    [0, 'QUEUED'],
    [1, 'FAILED'],
  ] as const)(
    'preserves retry failure semantics at attempt %s',
    async (attempt, status) => {
      const h = setup(attempt);
      h.findings.replaceForScan.mockRejectedValue(
        new Error('filesystem-secret-canary-02dc query-secret-canary-74ce'),
      );
      await expect(h.run()).rejects.toThrow(
        'ReactPulse could not complete the browser scan.',
      );
      expect(JSON.stringify(h.update.mock.calls)).not.toContain(
        'secret-canary',
      );
      expect(h.order).not.toContain('COMPLETED');
      expect(h.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status,
            failureCode: 'SCAN_EXECUTION_FAILED',
          }),
        }),
      );
    },
  );
  it('reconciles absent assessment without inventing observations', async () => {
    const h = setup(0, false);
    await h.run();
    expect(h.findings.replaceForScan).toHaveBeenCalledWith('scan', null);
  });
});

describe('accessibility persistence orchestration', () => {
  it('projects raw results before mapping and persists before completion', async () => {
    const h = setup();
    h.result.accessibility = {
      engine: 'axe-core',
      engineVersion: '4.13.0',
      rulesetVersion: 1,
      scope: 'MAIN_DOCUMENT',
      durationMs: 1,
      excludedFrameCount: 0,
      state: 'SUCCEEDED',
      raw: {
        violations: [
          {
            id: 'label',
            impact: 'serious',
            tags: [],
            nodes: [{ html: 'private-canary', target: ['private-canary'] }],
          },
        ],
        passes: [],
        incomplete: [],
        inapplicable: [],
      },
    } as unknown as AccessibilityObservation;
    await h.run();
    expect(h.accessibility.replaceForScan).toHaveBeenCalledWith(
      'scan',
      [
        expect.objectContaining({
          category: 'ACCESSIBILITY',
          ruleId: 'accessibility.axe-core.label',
        }),
      ],
      expect.objectContaining({ state: 'PARTIAL' }),
    );
    expect(
      JSON.stringify(h.accessibility.replaceForScan.mock.calls),
    ).not.toContain('private-canary');
    expect(h.order.slice(-5)).toEqual([
      'security',
      'accessibility',
      'PERFORMANCE',
      'NETWORK',
      'COMPLETED',
    ]);
  });
  it.each(['absent', 'unavailable'] as const)(
    'authoritatively reconciles %s results to zero without failing other analyses',
    async (state) => {
      const h = setup();
      if (state === 'unavailable')
        h.result.accessibility = {
          engine: 'axe-core',
          engineVersion: '4.13.0',
          rulesetVersion: 1,
          scope: 'MAIN_DOCUMENT',
          durationMs: 10,
          excludedFrameCount: 0,
          state: 'UNAVAILABLE',
          reason: 'ENGINE_TIMEOUT',
        };
      await h.run();
      expect(h.accessibility.replaceForScan).toHaveBeenCalledWith(
        'scan',
        [],
        state === 'absent'
          ? null
          : expect.objectContaining({ state: 'UNAVAILABLE' }),
      );
      expect(h.order).toEqual([
        'RUNNING',
        'browser',
        'evidence',
        'performance',
        'network',
        'security',
        'accessibility',
        'PERFORMANCE',
      'NETWORK',
      'COMPLETED',
      ]);
    },
  );
  it.each([
    [0, 'QUEUED'],
    [1, 'FAILED'],
  ] as const)(
    'contains persistence errors on attempt %s',
    async (attempt, status) => {
      const h = setup(attempt);
      h.accessibility.replaceForScan.mockRejectedValue(
        new Error('accessibility-input-secret-7712'),
      );
      await expect(h.run()).rejects.toThrow(
        'ReactPulse could not complete the browser scan.',
      );
      expect(h.order).not.toContain('COMPLETED');
      expect(h.order).toContain('security');
      expect(JSON.stringify(h.update.mock.calls)).not.toContain(
        'accessibility-input-secret-7712',
      );
      expect(h.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status }) }),
      );
    },
  );
});


describe('deterministic performance and network pipeline', () => {
  it('persists only approved candidates before completion', async () => {
    const h = setup();
    Object.assign(h.result.performance.metrics, { lcpMs: 2501, cls: 0.101 });
    Object.assign(h.result.network, { failures: [{ requestSequence: 0 }] });
    await h.run();
    expect(h.deterministic.replaceForScan).toHaveBeenNthCalledWith(1, 'scan', 'PERFORMANCE', [
      expect.objectContaining({ ruleId: 'performance.lcp.above-good-threshold' }),
      expect.objectContaining({ ruleId: 'performance.synthetic-cls.above-good-threshold' }),
    ]);
    expect(h.deterministic.replaceForScan).toHaveBeenNthCalledWith(2, 'scan', 'NETWORK', [expect.objectContaining({ ruleId: 'network.request-failure-observed', severity: 'INFO' })]);
    expect(h.order.slice(-3)).toEqual(['PERFORMANCE', 'NETWORK', 'COMPLETED']);
  });
  it('successful empty evaluations reconcile to empty sets', async () => {
    const h = setup();
    Object.assign(h.result.performance.metrics, { lcpMs: 2500, cls: 0.1 });
    await h.run();
    expect(h.deterministic.replaceForScan).toHaveBeenCalledWith('scan', 'PERFORMANCE', []);
    expect(h.deterministic.replaceForScan).toHaveBeenCalledWith('scan', 'NETWORK', []);
  });
  it('a thrown performance evaluator does not reconcile any finding set', async () => {
    const h = setup();
    Object.defineProperty(h.result.performance.metrics, 'lcpMs', { get() { throw new Error('persistence-token-canary-9182'); } });
    await expect(h.run()).rejects.toThrow('ReactPulse could not complete');
    expect(h.deterministic.replaceForScan).not.toHaveBeenCalled();
    expect(h.findings.replaceForScan).not.toHaveBeenCalled();
    expect(h.accessibility.replaceForScan).not.toHaveBeenCalled();
    expect(h.order).not.toContain('COMPLETED');
    expect(JSON.stringify(h.update.mock.calls)).not.toContain('persistence-token');
  });
  it('malformed network observations are failure, not destructive empty success', async () => {
    const h = setup();
    Object.assign(h.result.network, { failures: null });
    await expect(h.run()).rejects.toThrow('ReactPulse could not complete');
    expect(h.deterministic.replaceForScan).not.toHaveBeenCalled();
  });
});
