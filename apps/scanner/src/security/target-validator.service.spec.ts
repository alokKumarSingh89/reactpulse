import { describe, expect, it } from 'vitest';

import { TargetValidatorService } from './target-validator.service';

describe('TargetValidatorService', () => {
  const service = new TargetValidatorService();

  it.each([
    'http://127.0.0.1',
    'http://10.0.0.1',
    'http://192.168.1.10',
    'http://169.254.169.254',
    'http://localhost',
    'file:///etc/passwd',
  ])('rejects unsafe target %s', async (url) => {
    await expect(service.validate(url)).rejects.toThrow();
  });

  it('accepts a public target', async () => {
    const url = await service.validate('https://example.com');

    expect(url.hostname).toBe('example.com');
  });
});
