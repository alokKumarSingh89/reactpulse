import { describe, expect, it } from 'vitest';

import { mapNetworkMetrics } from './network-metric.mapper';

import type { NetworkObservation } from './network.types';

describe('mapNetworkMetrics', () => {
  it('maps network and resource aggregates', () => {
    const observation: NetworkObservation = {
      requests: [
        {
          sequence: 0,

          url: 'https://example.com/',

          method: 'GET',

          resourceType: 'document',

          domain: 'example.com',

          party: 'FIRST_PARTY',

          startedAtMs: 0,
        },

        {
          sequence: 1,

          url: 'https://example.com/app.js',

          method: 'GET',

          resourceType: 'script',

          domain: 'example.com',

          party: 'FIRST_PARTY',

          startedAtMs: 10,
        },

        {
          sequence: 2,

          url: 'https://analytics.example.net/script.js',

          method: 'GET',

          resourceType: 'script',

          domain: 'analytics.example.net',

          party: 'THIRD_PARTY',

          startedAtMs: 20,
        },
      ],

      responses: [
        {
          sequence: 0,

          requestSequence: 0,

          url: 'https://example.com/',

          status: 200,

          statusText: 'OK',

          domain: 'example.com',

          party: 'FIRST_PARTY',

          resourceType: 'document',

          durationMs: 100,

          transferSize: 1000,

          encodedBodySize: 900,

          decodedBodySize: null,

          fromServiceWorker: false,

          cacheControl: 'max-age=60',

          contentType: 'text/html',
        },

        {
          sequence: 1,

          requestSequence: 1,

          url: 'https://example.com/app.js',

          status: 200,

          statusText: 'OK',

          domain: 'example.com',

          party: 'FIRST_PARTY',

          resourceType: 'script',

          durationMs: 50,

          transferSize: 2000,

          encodedBodySize: 1900,

          decodedBodySize: null,

          fromServiceWorker: false,

          cacheControl: 'max-age=3600',

          contentType: 'application/javascript',
        },

        {
          sequence: 2,

          requestSequence: 2,

          url: 'https://analytics.example.net/script.js',

          status: 200,

          statusText: 'OK',

          domain: 'analytics.example.net',

          party: 'THIRD_PARTY',

          resourceType: 'script',

          durationMs: 70,

          transferSize: 3000,

          encodedBodySize: 2900,

          decodedBodySize: null,

          fromServiceWorker: false,

          cacheControl: null,

          contentType: 'application/javascript',
        },
      ],

      failures: [],
    };

    const metrics = mapNetworkMetrics(observation);

    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'NETWORK',

          key: 'request_count',

          value: 3,

          unit: 'count',
        }),

        expect.objectContaining({
          category: 'NETWORK',

          key: 'response_count',

          value: 3,

          unit: 'count',
        }),

        expect.objectContaining({
          category: 'NETWORK',

          key: 'failed_request_count',

          value: 0,

          unit: 'count',
        }),

        expect.objectContaining({
          category: 'NETWORK',

          key: 'third_party_request_count',

          value: 1,

          unit: 'count',
        }),

        expect.objectContaining({
          category: 'NETWORK',

          key: 'third_party_transfer_size',

          value: 3000,

          unit: 'bytes',
        }),

        expect.objectContaining({
          category: 'NETWORK',

          key: 'api_request_count',

          value: 0,

          unit: 'count',
        }),

        expect.objectContaining({
          category: 'RESOURCE',

          key: 'transfer_size',

          value: 6000,

          unit: 'bytes',
        }),

        expect.objectContaining({
          category: 'RESOURCE',

          key: 'javascript_transfer_size',

          value: 5000,

          unit: 'bytes',
        }),
      ]),
    );

    /*
     * Percentage calculations use floating-point
     * arithmetic. Do not assert exact equality.
     */
    const thirdPartyPercentage = metrics.find(
      (metric) =>
        metric.category === 'NETWORK' &&
        metric.key === 'third_party_request_percentage',
    );

    expect(thirdPartyPercentage).toBeDefined();

    expect(thirdPartyPercentage?.unit).toBe('percent');

    expect(thirdPartyPercentage?.value).toBeCloseTo(33.33333333333333, 10);
  });

  it('returns zero percentage when there are no requests', () => {
    const observation: NetworkObservation = {
      requests: [],

      responses: [],

      failures: [],
    };

    const metrics = mapNetworkMetrics(observation);

    const percentage = metrics.find(
      (metric) => metric.key === 'third_party_request_percentage',
    );

    expect(percentage?.value).toBe(0);
  });

  it('counts fetch and xhr requests as API requests', () => {
    const observation: NetworkObservation = {
      requests: [
        {
          sequence: 0,

          url: 'https://example.com/api/users',

          method: 'GET',

          resourceType: 'fetch',

          domain: 'example.com',

          party: 'FIRST_PARTY',

          startedAtMs: 0,
        },

        {
          sequence: 1,

          url: 'https://example.com/api/orders',

          method: 'GET',

          resourceType: 'xhr',

          domain: 'example.com',

          party: 'FIRST_PARTY',

          startedAtMs: 10,
        },

        {
          sequence: 2,

          url: 'https://example.com/app.js',

          method: 'GET',

          resourceType: 'script',

          domain: 'example.com',

          party: 'FIRST_PARTY',

          startedAtMs: 20,
        },
      ],

      responses: [],

      failures: [],
    };

    const metrics = mapNetworkMetrics(observation);

    const apiRequests = metrics.find(
      (metric) => metric.key === 'api_request_count',
    );

    expect(apiRequests?.value).toBe(2);
  });

  it('aggregates resource transfer sizes by type', () => {
    const observation: NetworkObservation = {
      requests: [],

      failures: [],

      responses: [
        createResponse('script', 1000, 0),

        createResponse('script', 2000, 1),

        createResponse('stylesheet', 300, 2),

        createResponse('image', 4000, 3),

        createResponse('font', 500, 4),
      ],
    };

    const metrics = mapNetworkMetrics(observation);

    expectMetric(metrics, 'javascript_transfer_size', 3000);

    expectMetric(metrics, 'stylesheet_transfer_size', 300);

    expectMetric(metrics, 'image_transfer_size', 4000);

    expectMetric(metrics, 'font_transfer_size', 500);

    expectMetric(metrics, 'transfer_size', 7800);
  });

  it('ignores unavailable transfer sizes', () => {
    const observation: NetworkObservation = {
      requests: [],

      failures: [],

      responses: [
        createResponse('script', 1000, 0),

        createResponse('script', null, 1),
      ],
    };

    const metrics = mapNetworkMetrics(observation);

    expectMetric(metrics, 'javascript_transfer_size', 1000);

    expectMetric(metrics, 'transfer_size', 1000);
  });
});

function createResponse(
  resourceType: string,
  transferSize: number | null,
  sequence: number,
): NetworkObservation['responses'][number] {
  return {
    sequence,

    requestSequence: sequence,

    url: `https://example.com/resource-${sequence}`,

    status: 200,

    statusText: 'OK',

    domain: 'example.com',

    party: 'FIRST_PARTY',

    resourceType,

    durationMs: 100,

    transferSize,

    encodedBodySize: transferSize,

    decodedBodySize: null,

    fromServiceWorker: false,

    cacheControl: null,

    contentType: null,
  };
}

function expectMetric(
  metrics: ReturnType<typeof mapNetworkMetrics>,

  key: string,

  expectedValue: number,
): void {
  const metric = metrics.find((candidate) => candidate.key === key);

  expect(metric).toBeDefined();

  expect(metric?.value).toBe(expectedValue);
}
