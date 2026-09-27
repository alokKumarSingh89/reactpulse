import { describe, expect, it } from 'vitest';
import {
  normalizeFailure,
  ScanExecutionError,
  ScanFailureCode,
} from './scan-failure';

describe('scan failure privacy', () => {
  it.each([
    new Error('filesystem-secret-canary-02dc query-secret-canary-74ce'),
    new ScanExecutionError(
      ScanFailureCode.NAVIGATION_FAILED,
      'userinfo-secret-canary-61fa',
    ),
  ])('never retains raw exception text', (error) => {
    const safe = normalizeFailure(error);
    expect(JSON.stringify(safe)).not.toContain('secret-canary');
    expect(safe.message.length).toBeGreaterThan(0);
  });
});
