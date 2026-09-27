import { describe, expect, it } from 'vitest';
import { evaluateNetworkFindings as evaluate } from './network-findings';
import { findingFingerprint } from '../findings/finding-fingerprint';
import type { NetworkFailureObservation } from './network.types';

function failure(requestSequence = 0): NetworkFailureObservation {
  return {
    sequence: requestSequence,
    requestSequence,
    url: 'https://example.com/a',
    method: 'GET',
    resourceType: 'script',
    domain: 'example.com',
    party: 'FIRST_PARTY',
    failureText: 'net::ERR_FAILED',
  };
}
describe('network failure findings', () => {
  it('does not infer transport failures from HTTP status or metrics', () => {
    for (const count of [0, 1, 100, -1, NaN, Infinity, -Infinity]) {
      const input = {
        failures: [],
        failed_request_count: count,
        responses: [{ status: 500 }, { status: 404 }],
      };
      expect(evaluate(input)).toEqual([]);
    }
  });
  it.each([1, 20, 100])(
    'aggregates %s observed failures without escalation',
    (count) => {
      const input = {
        failures: Array.from({ length: count }, (_, i) => failure(i)),
      };
      const result = evaluate(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        category: 'NETWORK',
        ruleId: 'network.request-failure-observed',
        ruleVersion: 1,
        severity: 'INFO',
        confidence: 'HIGH',
        affectedResource: { kind: 'MAIN_DOCUMENT' },
        evidence: {
          version: 1,
          context: 'SYNTHETIC',
          failureKind: 'REQUEST_FAILED',
          observedFailureCount: count,
        },
      });
      expect(result).toEqual(
        evaluate({ failures: [...input.failures].reverse() }),
      );
      expect(result[0].fingerprint).toBe(
        evaluate({ failures: [failure()] })[0].fingerprint,
      );
      expect(result[0].recommendation).toContain(
        'does not establish a root cause',
      );
    },
  );
  it('uses safe versioned aggregate identity with no samples or counts', () => {
    const result = evaluate({ failures: [failure()] })[0];
    expect(result.fingerprintIdentity).toEqual({
      category: 'NETWORK',
      ruleId: result.ruleId,
      ruleVersion: 1,
      subject: { kind: 'MAIN_DOCUMENT' },
    });
    expect(
      findingFingerprint({
        subject: { kind: 'MAIN_DOCUMENT' },
        ruleVersion: 1,
        ruleId: result.ruleId,
        category: 'NETWORK',
      }),
    ).toBe(result.fingerprint);
    expect(
      findingFingerprint({ ...result.fingerprintIdentity, ruleVersion: 2 }),
    ).not.toBe(result.fingerprint);
  });
  it.each([-1, NaN, Infinity, -Infinity, 1.5])(
    'rejects corrupted request reference %s',
    (requestSequence) => {
      expect(evaluate({ failures: [failure(requestSequence)] })).toEqual([]);
    },
  );
  it('fails closed on duplicate references and malformed runtime input', () => {
    expect(evaluate({ failures: [failure(), failure()] })).toEqual([]);
    expect(evaluate(JSON.parse('{"failures":null}'))).toEqual([]);
    expect(evaluate(JSON.parse('{"failures":[null]}'))).toEqual([]);
  });
  it('excludes all secret-bearing data rather than hashing it', () => {
    const canaries = [
      'network-email-canary@example.com',
      'network-token-canary-9182',
      'network-input-secret-7712',
      'network-query-secret-6631',
      'network-fragment-secret-5520',
    ];
    const row = {
      ...failure(),
      url: `https://user:password@example.com/${canaries[2]}?token=${canaries[3]}#${canaries[4]}`,
      failureText: canaries.join(' '),
      headers: canaries,
      body: canaries,
      stack: canaries,
    };
    const result = evaluate({ failures: [row], responses: [] } as {
      failures: NetworkFailureObservation[];
    });
    expect(result).toEqual(evaluate({ failures: [failure()] }));
    for (const canary of [...canaries, 'password', 'https://'])
      expect(JSON.stringify(result)).not.toContain(canary);
    expect(
      evaluate({
        failures: [
          {
            ...row,
            get url(): string {
              throw new Error('Do not read URL');
            },
          },
        ],
      }),
    ).toEqual(result);
  });
});
