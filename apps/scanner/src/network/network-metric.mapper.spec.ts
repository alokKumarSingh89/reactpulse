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
        }),

        expect.objectContaining({
          key: 'third_party_request_count',

          value: 1,
        }),

        expect.objectContaining({
          key: 'third_party_request_percentage',

          value: 100 / 3,
        }),

        expect.objectContaining({
          category: 'RESOURCE',

          key: 'transfer_size',

          value: 6000,
        }),

        expect.objectContaining({
          key: 'javascript_transfer_size',

          value: 5000,
        }),
      ]),
    );
  });
});
