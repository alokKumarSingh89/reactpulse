import { describe, expect, it } from 'vitest';

import { classifyNetworkParty } from './network-party';

describe('classifyNetworkParty', () => {
  it('classifies same hostname as first party', () => {
    expect(
      classifyNetworkParty('https://example.com', 'https://example.com/app.js'),
    ).toBe('FIRST_PARTY');
  });

  it('classifies subdomain as first party', () => {
    expect(
      classifyNetworkParty(
        'https://example.com',
        'https://static.example.com/app.js',
      ),
    ).toBe('FIRST_PARTY');
  });

  it('classifies unrelated host as third party', () => {
    expect(
      classifyNetworkParty(
        'https://example.com',
        'https://analytics.vendor.com/script.js',
      ),
    ).toBe('THIRD_PARTY');
  });
});
