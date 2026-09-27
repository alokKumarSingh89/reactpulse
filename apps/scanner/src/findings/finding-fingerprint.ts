import { createHash } from 'node:crypto';
import {
  projectFindingFingerprintIdentity,
  type FindingFingerprintIdentity,
} from '@reactpulse/contracts';

/** Safe identity only: callers project source observations before this boundary.
 * Reprojection rejects invalid runtime inputs and excludes extra properties.
 * Fixed category tuples preserve existing persisted fingerprints byte-for-byte;
 * object insertion order and caller serialization hooks cannot affect the hash.
 * Rule versions participate, evidence versions/counts/scan IDs do not. Cookie
 * ordinals remain scan-local references, not stable cross-scan cookie identity.
 */
export function findingFingerprint(input: FindingFingerprintIdentity): string {
  const identity = projectFindingFingerprintIdentity(input);
  if (!identity) throw new Error('Invalid finding fingerprint identity');
  const tuple =
    identity.category === 'SECURITY'
      ? [
          identity.category,
          identity.ruleId,
          identity.ruleVersion,
          identity.subject.kind === 'MAIN_DOCUMENT'
            ? 'main-document'
            : `document:${identity.subject.documentResponseOrdinal}:cookie:${identity.subject.cookieOrdinal}`,
        ]
      : identity.category === 'PERFORMANCE'
        ? [
            identity.category,
            identity.ruleId,
            identity.ruleVersion,
            identity.metric,
            'main-document',
          ]
        : [
            identity.category,
            identity.engine,
            identity.engineRuleId,
            identity.ruleVersion,
            identity.rulesetVersion,
            identity.mappingVersion,
            identity.profileId,
            'main-document',
          ];
  return createHash('sha256').update(JSON.stringify(tuple)).digest('hex');
}
