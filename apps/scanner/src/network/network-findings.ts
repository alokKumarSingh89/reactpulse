import {
  NETWORK_FINDING_RULE_ID,
  projectDeterministicFindingCandidate,
  type DeterministicFindingCandidate,
} from '@reactpulse/contracts';
import { findingFingerprint } from '../findings/finding-fingerprint';
import type { NetworkObservation } from './network.types';

type Candidate = Extract<
  DeterministicFindingCandidate,
  { category: 'NETWORK' }
>;
/** Collector requestfailed observations are authoritative, not aggregate metrics
 * or HTTP status. Counts describe observed traffic, not completeness or impact.
 * Only request identity is read; URLs/errors/bodies never cross this boundary.
 */
export function evaluateNetworkFindings(
  observation: Pick<NetworkObservation, 'failures'>,
  options: { throwOnInvalid?: boolean } = {},
): (Candidate & { fingerprint: string })[] {
  try {
    if (!Array.isArray(observation.failures)) throw new Error();
    const requests = new Set<number>();
    for (const failure of observation.failures) {
      if (!failure || typeof failure !== 'object') throw new Error();
      const reference = failure.requestSequence;
      if (!Number.isSafeInteger(reference) || reference < 0) throw new Error();
      // Normal collector events identify one failed request. Fail closed on
      // malformed duplicates instead of manufacturing or inflating its count.
      if (requests.has(reference)) throw new Error();
      requests.add(reference);
    }
    if (!requests.size) return [];
    const candidate = projectDeterministicFindingCandidate({
      category: 'NETWORK',
      ruleId: NETWORK_FINDING_RULE_ID,
      ruleVersion: 1,
      severity: 'INFO',
      confidence: 'HIGH',
      affectedResource: { kind: 'MAIN_DOCUMENT' },
      fingerprintIdentity: {
        category: 'NETWORK',
        ruleId: NETWORK_FINDING_RULE_ID,
        ruleVersion: 1,
        subject: { kind: 'MAIN_DOCUMENT' },
      },
      evidence: {
        version: 1,
        context: 'SYNTHETIC',
        failureKind: 'REQUEST_FAILED',
        observedFailureCount: requests.size,
      },
    });
    return candidate?.category === 'NETWORK'
      ? [
          {
            ...candidate,
            fingerprint: findingFingerprint(candidate.fingerprintIdentity),
          },
        ]
      : [];
  } catch {
    if (options.throwOnInvalid)
      throw new Error('Invalid network finding observations');
    return [];
  }
}
