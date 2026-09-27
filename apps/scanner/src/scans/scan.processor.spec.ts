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
    browser: { name: 'chromium', version: '1' },
    performance: { metrics: {} },
    network: {},
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
    findings = step('security');
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
  return { run, order, update, findings };
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
        new Error('persistence failed'),
      );
      await expect(h.run()).rejects.toThrow('persistence failed');
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
