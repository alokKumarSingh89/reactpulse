import { describe, expect, it } from 'vitest';

import { calculateClsSessionWindow } from './cls-session-window';

describe('calculateClsSessionWindow', () => {
  it('returns zero when there are no layout shifts', () => {
    expect(calculateClsSessionWindow([])).toBe(0);
  });

  it('sums shifts inside the same session window', () => {
    const result = calculateClsSessionWindow([
      {
        value: 0.05,
        startTime: 100,
        hadRecentInput: false,
      },
      {
        value: 0.04,
        startTime: 800,
        hadRecentInput: false,
      },
      {
        value: 0.03,
        startTime: 1500,
        hadRecentInput: false,
      },
    ]);

    expect(result).toBeCloseTo(0.12);
  });

  it('starts a new session when the gap exceeds one second', () => {
    const result = calculateClsSessionWindow([
      {
        value: 0.05,
        startTime: 100,
        hadRecentInput: false,
      },
      {
        value: 0.04,
        startTime: 500,
        hadRecentInput: false,
      },

      {
        value: 0.2,
        startTime: 2000,
        hadRecentInput: false,
      },
    ]);

    expect(result).toBeCloseTo(0.2);
  });

  it('uses the largest session window', () => {
    const result = calculateClsSessionWindow([
      {
        value: 0.05,
        startTime: 100,
        hadRecentInput: false,
      },
      {
        value: 0.05,
        startTime: 500,
        hadRecentInput: false,
      },

      {
        value: 0.15,
        startTime: 2000,
        hadRecentInput: false,
      },
      {
        value: 0.1,
        startTime: 2500,
        hadRecentInput: false,
      },
    ]);

    expect(result).toBeCloseTo(0.25);
  });

  it('starts a new session after five seconds', () => {
    const result = calculateClsSessionWindow([
      {
        value: 0.1,
        startTime: 0,
        hadRecentInput: false,
      },
      {
        value: 0.1,
        startTime: 900,
        hadRecentInput: false,
      },
      {
        value: 0.1,
        startTime: 1800,
        hadRecentInput: false,
      },
      {
        value: 0.1,
        startTime: 2700,
        hadRecentInput: false,
      },
      {
        value: 0.1,
        startTime: 3600,
        hadRecentInput: false,
      },
      {
        value: 0.1,
        startTime: 4500,
        hadRecentInput: false,
      },
      {
        value: 0.2,
        startTime: 5400,
        hadRecentInput: false,
      },
    ]);

    expect(result).toBeCloseTo(0.6);
  });

  it('ignores layout shifts caused by recent input', () => {
    const result = calculateClsSessionWindow([
      {
        value: 0.05,
        startTime: 100,
        hadRecentInput: false,
      },
      {
        value: 0.9,
        startTime: 500,
        hadRecentInput: true,
      },
      {
        value: 0.05,
        startTime: 800,
        hadRecentInput: false,
      },
    ]);

    expect(result).toBeCloseTo(0.1);
  });

  it('sorts entries by start time before calculating', () => {
    const result = calculateClsSessionWindow([
      {
        value: 0.03,
        startTime: 800,
        hadRecentInput: false,
      },
      {
        value: 0.04,
        startTime: 100,
        hadRecentInput: false,
      },
    ]);

    expect(result).toBeCloseTo(0.07);
  });
});
