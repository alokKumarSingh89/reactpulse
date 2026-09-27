import { describe, expect, it, vi } from 'vitest';
import type { BrowserScanResult } from '../browser/browser.types';
import type { DatabaseService } from '../database/database.service';
import { projectSafeEvidence } from './safe-evidence';
import { ScanEvidenceService } from './scan-evidence.service';

const secret = 'authorization-secret-canary-9f31_cookie-secret-canary-8ab2_query-secret-canary-74ce_userinfo-secret-canary-61fa_fragment-secret-canary-44bd_nonce-secret-canary-27aa_console-secret-canary-13ef_filesystem-secret-canary-02dc';
function fixture() {
  const network = {
    sequence: 0,
    requestSequence: 0,
    url: `https://user:${secret}@example.com/app.js?unknown=${secret}#${secret}`,
    domain: secret,
    method: 'GET',
    resourceType: 'script',
    party: 'FIRST_PARTY',
    status: 200,
    statusText: secret,
    durationMs: 20,
    transferSize: 42,
    encodedBodySize: 30,
    decodedBodySize: 60,
    startedAtMs: 0,
    fromServiceWorker: false,
    cacheControl: `public, max-age=60, custom=${secret}`,
    contentType: `application/javascript; secret=${secret}`,
    failureText: secret,
    extra: secret,
  };
  return {
    browser: {
      name: secret,
      version: secret,
      userAgent: secret,
      extra: secret,
    },
    navigation: {
      requestedUrl: `https://example.com/${secret}?x=${secret}`,
      finalUrl: `https://example.com/${secret}#${secret}`,
      status: 200,
      durationMs: 100,
      extra: secret,
    },
    documentResponse: {
      url: `https://example.com/${secret}`,
      status: 200,
      statusText: secret,
      headers: {
        Authorization: secret,
        'Proxy-Authorization': secret,
        Cookie: secret,
        'Set-Cookie': secret,
        'X-Custom': secret,
      },
    },
    network: { requests: [network], responses: [network], failures: [network] },
    consoleMessages: [
      { type: 'log', text: secret, arguments: [secret], stack: secret },
      { type: secret, text: secret },
    ],
    performance: {
      metrics: {
        ttfbMs: 150,
        cls: 0,
        domNodes: 3,
        lcpMs: secret,
        fcpMs: NaN,
        loadEventMs: Infinity,
        navigationDurationMs: -1,
        extra: secret,
        resources: { count: 1, transferSize: 42, extra: secret },
        layoutShifts: [
          { value: 0.2, startTime: 100, hadRecentInput: false, extra: secret },
          { value: secret, startTime: 0, hadRecentInput: false },
        ],
      },
      longTasks: [
        { startTime: 0, duration: 80, extra: secret },
        { startTime: 1, duration: -1 },
      ],
    },
    extra: secret,
  };
}

describe('safe evidence persistence', () => {
  it('projects all current evidence types before Prisma, excluding secret canaries', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 10 });
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const tx = { scanEvidence: { createMany, deleteMany } };
    const database = {
      client: {
        $transaction: async (
          callback: (transaction: typeof tx) => Promise<void>,
        ) => callback(tx),
      },
    } as unknown as DatabaseService;
    const input = fixture();
    await new ScanEvidenceService(database).replaceForScan(
      'scan-id',
      input as unknown as BrowserScanResult,
    );
    expect(deleteMany).toHaveBeenCalledWith({ where: { scanId: 'scan-id' } });
    expect(deleteMany).toHaveBeenCalledBefore(createMany);
    const rows = createMany.mock.calls[0][0].data as ReturnType<
      typeof projectSafeEvidence
    >;
    expect(JSON.stringify(rows)).not.toContain(secret);
    expect(new Set(rows.map((row) => row.type)).size).toBe(9);
    expect(rows.find((row) => row.type === 'DOCUMENT_RESPONSE')?.data).toEqual({
      url: 'https://example.com',
      status: 200,
    });
    expect(
      rows.filter((row) => row.type === 'CONSOLE').map((row) => row.data),
    ).toEqual([{ type: 'log' }, { type: 'unknown' }]);
    const response = rows.find((row) => row.type === 'NETWORK_RESPONSE')!.data;
    expect(response).toMatchObject({
      url: 'https://example.com/app.js',
      domain: 'example.com',
      cacheControl: 'public, max-age=60',
      contentType: 'application/javascript',
      statusText: '',
      transferSize: 42,
    });
    expect(input.browser.userAgent).toBe(secret);
    expect(input.documentResponse.headers.Authorization).toBe(secret);
  });

  it('preserves valid numbers and zeroes while dropping malformed numeric data', () => {
    const rows = projectSafeEvidence(fixture());
    const metrics = rows.find((row) => row.type === 'PERFORMANCE')!.data;
    expect(metrics).toMatchObject({
      ttfbMs: 150,
      cls: 0,
      lcpMs: null,
      fcpMs: null,
      loadEventMs: null,
      navigationDurationMs: null,
      layoutShifts: [{ value: 0.2, startTime: 100, hadRecentInput: false }],
    });
    expect(
      rows.filter((row) => row.type === 'LONG_TASK').map((row) => row.data),
    ).toEqual([{ startTime: 0, duration: 80 }]);
  });

  it.each([
    null,
    undefined,
    secret,
    [],
    { network: secret, performance: secret },
  ])('never falls back to malformed input', (input) => {
    const rows = projectSafeEvidence(input);
    expect(JSON.stringify(rows)).not.toContain(secret);
    expect(rows.map((row) => row.type)).toEqual([
      'BROWSER',
      'NAVIGATION',
      'PERFORMANCE',
    ]);
  });

  it('bounds arrays and rejects invalid or duplicate network sequences', () => {
    const input = fixture();
    const valid = input.network.requests[0];
    input.network.requests = [
      valid,
      valid,
      { ...valid, sequence: -1 },
      { ...valid, sequence: NaN },
    ];
    input.consoleMessages = Array(1100).fill(input.consoleMessages[0]);
    input.performance.longTasks = Array(5100).fill(
      input.performance.longTasks[0],
    );
    input.performance.metrics.layoutShifts = Array(5100).fill(
      input.performance.metrics.layoutShifts[0],
    );
    const rows = projectSafeEvidence(input);
    expect(rows.filter((row) => row.type === 'NETWORK_REQUEST')).toHaveLength(
      1,
    );
    expect(rows.filter((row) => row.type === 'CONSOLE')).toHaveLength(1000);
    expect(rows.filter((row) => row.type === 'LONG_TASK')).toHaveLength(5000);
    expect(
      rows.find((row) => row.type === 'PERFORMANCE')!.data.layoutShifts,
    ).toHaveLength(5000);
  });

  it('keeps known browser identity but never arbitrary browser strings', () => {
    expect(
      projectSafeEvidence({
        browser: {
          name: 'chromium',
          version: '123.0.1234.56',
          userAgent: secret,
        },
      })[0].data,
    ).toEqual({ name: 'chromium', version: '123.0.1234.56' });
  });
});
