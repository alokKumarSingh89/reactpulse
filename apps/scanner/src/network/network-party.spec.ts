import { describe, expect, it } from 'vitest';

import { classifyNetworkParty } from './network-party';

describe('classifyNetworkParty', () => {
  it('classifies the same hostname as first party', () => {
    expect(
      classifyNetworkParty('https://example.com', 'https://example.com/app.js'),
    ).toBe('FIRST_PARTY');
  });

  it('classifies sibling subdomains as first party', () => {
    expect(
      classifyNetworkParty(
        'https://app.example.com',
        'https://cdn.example.com/app.js',
      ),
    ).toBe('FIRST_PARTY');
  });

  it('handles multi-level public suffixes', () => {
    expect(
      classifyNetworkParty(
        'https://app.example.co.uk',
        'https://static.example.co.uk/app.js',
      ),
    ).toBe('FIRST_PARTY');
  });

  it('classifies unrelated domains as third party', () => {
    expect(
      classifyNetworkParty(
        'https://example.com',
        'https://analytics.vendor.com/script.js',
      ),
    ).toBe('THIRD_PARTY');
  });

  it('does not treat different private suffix tenants as first party', () => {
    expect(
      classifyNetworkParty(
        'https://foo.github.io',
        'https://bar.github.io/app.js',
      ),
    ).toBe('THIRD_PARTY');
  });

  it('fails closed for invalid URLs', () => {
    expect(classifyNetworkParty('https://example.com', 'invalid-url')).toBe(
      'THIRD_PARTY',
    );
  });
});
