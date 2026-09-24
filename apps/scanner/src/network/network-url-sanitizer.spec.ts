import { describe, expect, it } from 'vitest';

import { sanitizeNetworkUrl } from './network-url-sanitizer';

describe('sanitizeNetworkUrl', () => {
  it('removes fragments', () => {
    expect(sanitizeNetworkUrl('https://example.com/app#profile')).toBe(
      'https://example.com/app',
    );
  });

  it('redacts sensitive query values', () => {
    const result = sanitizeNetworkUrl(
      'https://example.com/api?token=secret123&page=2',
    );

    expect(result).toContain('token=%5BREDACTED%5D');

    expect(result).toContain('page=2');

    expect(result).not.toContain('secret123');
  });

  it('redacts api keys', () => {
    const result = sanitizeNetworkUrl(
      'https://example.com/data?api_key=my-key',
    );

    expect(result).not.toContain('my-key');
  });

  it('handles invalid URLs safely', () => {
    expect(sanitizeNetworkUrl('not-a-url')).toBe('[INVALID_URL]');
  });
});
