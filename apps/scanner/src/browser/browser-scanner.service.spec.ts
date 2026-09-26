import { ConfigService } from '@nestjs/config';
import { chromium, type Browser, type Route } from 'playwright';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NetworkCollectorService } from '../network/network-collector.service';
import { PerformanceCollectorService } from '../performance/performance-collector.service';
import { PERFORMANCE_INIT_SCRIPT } from '../performance/performance-init-script';
import { TargetValidatorService } from '../security/target-validator.service';
import { BrowserScannerService } from './browser-scanner.service';
import { DESKTOP_PROFILE } from './scan-profile';

const target = 'https://example.com/';

function setup() {
  const page = {
    on: vi.fn(),
    route: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      return { status: () => 200 };
    }),
    url: vi.fn().mockReturnValue(target),
    evaluate: vi.fn().mockResolvedValue('test-browser'),
  };
  const context = {
    addInitScript: vi.fn().mockResolvedValue(undefined),
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const browser = {
    newContext: vi.fn().mockResolvedValue(context),
    version: () => 'test-version',
    close: vi.fn().mockResolvedValue(undefined),
  };
  vi.spyOn(chromium, 'launch').mockResolvedValue(browser as unknown as Browser);
  const validator = new TargetValidatorService();
  const validate = vi
    .spyOn(validator, 'validate')
    .mockResolvedValue(new URL(target));
  const performanceCollector = new PerformanceCollectorService();
  const collect = vi.spyOn(performanceCollector, 'collect').mockResolvedValue({
    metrics: {} as Awaited<
      ReturnType<PerformanceCollectorService['collect']>
    >['metrics'],
    longTasks: [],
  });
  const config = new ConfigService({
    SCANNER_MAX_REQUESTS: 500,
    SCANNER_NAVIGATION_TIMEOUT_MS: 12345,
  });
  const networkCollector = new NetworkCollectorService(config);
  const getObservation = vi
    .fn()
    .mockResolvedValue({ requests: [], responses: [], failures: [] });
  const attach = vi
    .spyOn(networkCollector, 'attach')
    .mockReturnValue({ getObservation });
  const service = new BrowserScannerService(
    config,
    validator,
    performanceCollector,
    networkCollector,
  );
  return {
    service,
    page,
    context,
    browser,
    validate,
    collect,
    attach,
    getObservation,
  };
}

beforeEach(() =>
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }),
);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BrowserScannerService', () => {
  it('initializes once before creating the page and observes the full profile window', async () => {
    const h = setup();
    const resultPromise = h.service.scan(target);
    await vi.advanceTimersByTimeAsync(100);

    expect(h.context.addInitScript).toHaveBeenCalledExactlyOnceWith({
      content: PERFORMANCE_INIT_SCRIPT,
    });
    expect(h.context.addInitScript).toHaveBeenCalledBefore(h.context.newPage);
    expect(h.context.newPage).toHaveBeenCalledBefore(h.page.goto);
    expect(h.browser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({ viewport: DESKTOP_PROFILE.viewport }),
    );
    expect(h.attach).toHaveBeenCalledExactlyOnceWith(h.page, target);
    expect(h.attach).toHaveBeenCalledBefore(h.page.goto);
    expect(h.page.goto).toHaveBeenCalledWith(target, {
      waitUntil: 'domcontentloaded',
      timeout: 12345,
    });
    expect(h.validate).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(DESKTOP_PROFILE.observationWindowMs - 1);
    expect(h.collect).not.toHaveBeenCalled();
    expect(h.getObservation).not.toHaveBeenCalled();
    const currentUrl = 'https://example.com/after-navigation';
    h.page.url.mockReturnValue(currentUrl);
    await vi.advanceTimersByTimeAsync(1);
    const result = await resultPromise;

    expect(h.validate).toHaveBeenLastCalledWith(currentUrl);
    expect(h.validate).toHaveBeenCalledTimes(3);
    expect(h.validate).toHaveBeenCalledBefore(h.collect);
    expect(h.collect).toHaveBeenCalledBefore(h.getObservation);
    expect(result.navigation.finalUrl).toBe(currentUrl);
    // Controlled virtual time, not a wall-clock timing assertion.
    expect(result.navigation.durationMs).toBe(100);
    expect(h.context.close).toHaveBeenCalledOnce();
    expect(h.browser.close).toHaveBeenCalledOnce();
  });

  it.each([
    'initialization',
    'navigation',
    'validation',
    'collection',
  ] as const)(
    'closes the context and browser after %s failure',
    async (stage) => {
      const h = setup();
      const error = new Error('test failure');
      if (stage === 'initialization')
        h.context.addInitScript.mockRejectedValue(error);
      if (stage === 'navigation')
        h.page.goto.mockRejectedValue(
          Object.assign(error, { name: 'TimeoutError' }),
        );
      if (stage === 'validation')
        h.validate
          .mockResolvedValueOnce(new URL(target))
          .mockResolvedValueOnce(new URL(target))
          .mockRejectedValue(error);
      if (stage === 'collection') h.collect.mockRejectedValue(error);
      const assertion = expect(h.service.scan(target)).rejects.toThrow(
        stage === 'navigation' ? 'Target navigation timed out' : 'test failure',
      );
      await vi.runAllTimersAsync();
      await assertion;
      expect(h.context.close).toHaveBeenCalledOnce();
      expect(h.browser.close).toHaveBeenCalledOnce();
      expect(h.getObservation).not.toHaveBeenCalled();
      if (stage === 'validation') expect(h.collect).not.toHaveBeenCalled();
    },
  );

  it('preserves request routing validation and aborts rejected destinations', async () => {
    const h = setup();
    const result = h.service.scan(target);
    await vi.runAllTimersAsync();
    await result;
    const handler = h.page.route.mock.calls[0][1] as (
      route: Route,
    ) => Promise<void>;
    const route = {
      request: () => ({ url: () => 'http://127.0.0.1/' }),
      continue: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    };
    h.validate.mockRejectedValue(new Error('blocked'));
    await handler(route as unknown as Route);
    expect(h.validate).toHaveBeenLastCalledWith('http://127.0.0.1/');
    expect(route.abort).toHaveBeenCalledWith('blockedbyclient');
    expect(route.continue).not.toHaveBeenCalled();
  });
});
