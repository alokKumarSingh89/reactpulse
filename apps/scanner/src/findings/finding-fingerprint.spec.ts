import { describe, expect, it } from 'vitest';
import {
  projectFindingFingerprintIdentity,
  type FindingFingerprintIdentity,
} from '@reactpulse/contracts';
import { findingFingerprint as fingerprint } from './finding-fingerprint';

const security = {
  category: 'SECURITY',
  ruleId: 'security.transport.insecure-final',
  ruleVersion: 1,
  subject: { kind: 'MAIN_DOCUMENT' },
} as const satisfies FindingFingerprintIdentity;
const cookie = {
  category: 'SECURITY',
  ruleId: 'security.cookie.secure-missing',
  ruleVersion: 1,
  subject: { kind: 'COOKIE', documentResponseOrdinal: 0, cookieOrdinal: 1 },
} as const satisfies FindingFingerprintIdentity;
const accessibility = {
  category: 'ACCESSIBILITY',
  ruleId: 'accessibility.axe-core.label',
  ruleVersion: 1,
  subject: { kind: 'MAIN_DOCUMENT' },
  engine: 'axe-core',
  engineRuleId: 'label',
  rulesetVersion: 1,
  mappingVersion: 1,
  profileId: 'main-document-v1',
} as const satisfies FindingFingerprintIdentity;

describe('finding fingerprint', () => {
  it('preserves pre-extraction SHA-256 tuple golden values', () => {
    expect(fingerprint(security)).toBe(
      '954b1c3a489442ced5ce27a5fa707a7d527c23aaab9fcdaba40607509e4b7be4',
    );
    expect(fingerprint(cookie)).toBe(
      'a60dcc2fe240fc771c13b96e595671acdd5bcd6e8b7f6cdb75406a6853635a1c',
    );
    expect(fingerprint(accessibility)).toBe(
      '814e2368ed0f16d09571bc94bf1fdee7bf2d1720bceaf36ff6d4d526e414d181',
    );
  });
  it('is stable across repeated calls and property construction order', () => {
    for (const identity of [security, cookie, accessibility]) {
      const reordered = projectFindingFingerprintIdentity(
        Object.fromEntries(Object.entries(identity).reverse()),
      );
      expect(reordered).not.toBeNull();
      if (!reordered) throw new Error('Invalid fixture');
      for (let i = 0; i < 5; i++)
        expect(fingerprint(reordered)).toBe(fingerprint(identity));
    }
  });
  it('separates categories, rules, semantic versions and safe resources', () => {
    const identities: FindingFingerprintIdentity[] = [
      security,
      cookie,
      accessibility,
      { ...security, ruleId: 'security.transport.downgrade' },
      { ...security, ruleVersion: 2 },
      { ...cookie, subject: { ...cookie.subject, cookieOrdinal: 2 } },
      { ...cookie, subject: { ...cookie.subject, documentResponseOrdinal: 1 } },
      {
        ...accessibility,
        ruleId: 'accessibility.axe-core.image-alt',
        engineRuleId: 'image-alt',
      },
      { ...accessibility, ruleVersion: 2 },
      { ...accessibility, mappingVersion: 2 },
      { ...accessibility, rulesetVersion: 2 },
    ];
    expect(new Set(identities.map(fingerprint)).size).toBe(identities.length);
  });
  it('projects source extras before hashing, without scan or measurement identity', () => {
    const canaries = [
      'findings-email-canary@example.com',
      'findings-token-canary-9182',
      'findings-input-secret-7712',
      'findings-dom-secret-6631',
      'findings-url-secret-5520',
    ];
    for (const identity of [security, accessibility]) {
      const safe = projectFindingFingerprintIdentity({
        ...identity,
        scanId: 'other-scan',
        evidence: { text: canaries },
        subject: { ...identity.subject, url: canaries[4] },
        toJSON: () => {
          throw new Error('Must not serialize source');
        },
      });
      expect(safe).toEqual(identity);
      for (const canary of canaries)
        expect(JSON.stringify(safe)).not.toContain(canary);
      if (!safe) throw new Error('Invalid fixture');
      expect(fingerprint(safe)).toBe(fingerprint(identity));
    }
  });
  it('fails closed for invalid typed values and never echoes getter errors', () => {
    expect(() => fingerprint({ ...security, ruleVersion: NaN })).toThrow(
      'Invalid finding fingerprint identity',
    );
    expect(() =>
      fingerprint({
        ...security,
        get ruleVersion(): number {
          throw new Error('private');
        },
      }),
    ).toThrow(/^Invalid finding fingerprint identity$/);
  });
});

// Compile-only public API checks; never execute raw source hashing.
function typeBoundary() {
  // @ts-expect-error Raw engine evidence is not a fingerprint identity.
  fingerprint({ evidence: { html: 'raw' } });
  fingerprint({
    ...security,
    // @ts-expect-error Raw URL is not a safe subject.
    subject: { kind: 'URL', url: 'https://example.com' },
  });
}
void typeBoundary;
