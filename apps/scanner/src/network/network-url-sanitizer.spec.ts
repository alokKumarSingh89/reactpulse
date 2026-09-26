import { describe, expect, it } from 'vitest';

import {
  projectSafeUrlOrigin,
  sanitizeNetworkUrl,
} from './network-url-sanitizer';

const canary = 'SECRET_CANARY_7f92';

describe.each([
  ['network', sanitizeNetworkUrl, 'https://example.com/app'],
  ['origin', projectSafeUrlOrigin, 'https://example.com'],
] as const)('%s URL projection', (_name, project, expected) => {
  it.each([
    `https://${canary}:${canary}@example.com/app`,
    `https://example.com/app?access_token=${canary}`,
    `https://example.com/app?unexpected_parameter=${canary}`,
    `https://example.com/app?a=${canary}&page=2&a=other&${canary}=value`,
    `https://example.com/app#${canary}`,
    `https://user%40${canary}:pass%3A${canary}@example.com/app?x=%53ECRET_CANARY_7f92#${canary}`,
  ])('discards structurally sensitive components: %s', (input) => {
    const result = project(input);
    expect(result).toBe(expected);
    expect(result).not.toContain(canary);
    const parsed = new URL(result);
    expect(parsed.username).toBe('');
    expect(parsed.password).toBe('');
    expect(parsed.search).toBe('');
    expect(parsed.hash).toBe('');
  });

  it.each([
    '',
    `not-a-url-${canary}`,
    `https://[malformed/${canary}`,
    `/relative/${canary}`,
    `data:text/plain,${canary}`,
    `javascript:${canary}`,
    `file:///tmp/${canary}`,
    `blob:https://example.com/${canary}`,
    `https://example.com/?x=${canary.repeat(10_000)}`,
  ])(
    'returns a bounded fallback without throwing or echoing input',
    (input) => {
      expect(() => project(input)).not.toThrow();
      expect(project(input)).toBe('[INVALID_URL]');
    },
  );

  it.each([
    ['http://192.0.2.1/asset?q=secret', 'http://192.0.2.1'],
    ['https://[2001:db8::1]:8443/asset?q=secret', 'https://[2001:db8::1]:8443'],
  ])(
    'preserves parseable IP origins without making an SSRF decision',
    (input, origin) => {
      expect(new URL(project(input)).origin).toBe(origin);
    },
  );

  it('is idempotent', () => {
    const first = project(`https://example.com/app?x=${canary}`);
    expect(project(first)).toBe(first);
    expect(project('[INVALID_URL]')).toBe('[INVALID_URL]');
  });
});

describe('network compatibility and origin minimization', () => {
  it.each([
    [
      'https://app.example.com/assets/app.js?v=123',
      'https://app.example.com/assets/app.js',
    ],
    [
      'https://cdn.vendor.net/fonts/site.woff2?key=secret',
      'https://cdn.vendor.net/fonts/site.woff2',
    ],
    [
      'HTTPS://EXAMPLE.COM:443/a%20b.js?q=%2Fsecret',
      'https://example.com/a%20b.js',
    ],
    ['https://example.com', 'https://example.com/'],
  ])('retains the normalized network pathname', (input, expected) => {
    expect(sanitizeNetworkUrl(input)).toBe(expected);
  });

  it('drops even secret-bearing paths from the origin projection', () => {
    const input = `https://example.com/reset/${canary}?x=${canary}`;
    expect(projectSafeUrlOrigin(input)).toBe('https://example.com');
    // Explicit compatibility limitation: network path secrets are not detected.
    expect(sanitizeNetworkUrl(input)).toBe(
      `https://example.com/reset/${canary}`,
    );
  });

  it('bounds network output without truncating into a misleading URL', () => {
    const input = `https://example.com/${'a'.repeat(5000)}`;
    expect(sanitizeNetworkUrl(input)).toBe('[INVALID_URL]');
    expect(projectSafeUrlOrigin(input)).toBe('https://example.com');
  });
});
