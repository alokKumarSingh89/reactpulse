import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, type Browser } from 'playwright';

import { PerformanceCollectorService } from '../performance/performance-collector.service';

import { PERFORMANCE_INIT_SCRIPT } from '../performance/performance-init-script';

import { ScanExecutionError, ScanFailureCode } from '../scans/scan-failure';

import { TargetValidatorService } from '../security/target-validator.service';

import type {
  BrowserScanResult,
  ConsoleEvidence,
  DocumentResponseEvidence,
  NetworkRequestEvidence,
} from './browser.types';

import { DESKTOP_PROFILE } from './scan-profile';

@Injectable()
export class BrowserScannerService {
  constructor(
    private readonly config: ConfigService,
    private readonly targetValidator: TargetValidatorService,
    private readonly performanceCollector: PerformanceCollectorService,
  ) {}

  async scan(targetUrl: string): Promise<BrowserScanResult> {
    /*
     * Validate the initial target before
     * launching Chromium.
     */
    await this.targetValidator.validate(targetUrl);
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({
        headless: true,
      });
    } catch {
      throw new ScanExecutionError(
        ScanFailureCode.BROWSER_LAUNCH_FAILED,
        'Unable to launch browser',
      );
    }

    try {
      return await this.execute(browser, targetUrl);
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  private async execute(
    browser: Browser,
    targetUrl: string,
  ): Promise<BrowserScanResult> {
    const navigationTimeout = this.config.get<number>(
      'SCANNER_NAVIGATION_TIMEOUT_MS',
      30_000,
    );

    const maxRequests = this.config.get<number>('SCANNER_MAX_REQUESTS', 500);
    const maxConsoleMessages = this.config.get<number>(
      'SCANNER_MAX_CONSOLE_MESSAGES',
      100,
    );
    const context = await browser.newContext({
      viewport: DESKTOP_PROFILE.viewport,
      ignoreHTTPSErrors: false,
      acceptDownloads: false,
      serviceWorkers: 'block',
    });

    try {
      /*
       * Critical:
       *
       * Performance observers must exist
       * before application JavaScript
       * begins execution.
       */
      await context.addInitScript(PERFORMANCE_INIT_SCRIPT);

      const page = await context.newPage();

      const requests: NetworkRequestEvidence[] = [];

      const consoleMessages: ConsoleEvidence[] = [];

      let documentResponse: DocumentResponseEvidence | null = null;

      page.on('request', (request) => {
        if (requests.length >= maxRequests) {
          return;
        }

        requests.push({
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType(),
        });
      });

      page.on('console', (message) => {
        if (consoleMessages.length >= maxConsoleMessages) {
          return;
        }

        consoleMessages.push({
          type: message.type(),

          text: this.sanitizeConsoleText(message.text()),
        });
      });

      page.on('response', async (response) => {
        if (response.request().resourceType() !== 'document') {
          return;
        }

        try {
          documentResponse = {
            url: response.url(),
            status: response.status(),
            statusText: response.statusText(),
            headers: this.sanitizeHeaders(await response.allHeaders()),
          };
        } catch {
          /*
           * Evidence collection should
           * not fail the whole scan.
           */
        }
      });

      /*
       * Application-level network policy.
       *
       * This validates redirects and
       * subresource destinations.
       *
       * Container/network-level controls
       * are still required for production.
       */
      await page.route('**/*', async (route) => {
        const request = route.request();

        try {
          await this.targetValidator.validate(request.url());

          await route.continue();
        } catch {
          await route.abort('blockedbyclient');
        }
      });

      const startedAt = performance.now();

      let response;

      try {
        response = await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',

          timeout: navigationTimeout,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
          throw new ScanExecutionError(
            ScanFailureCode.NAVIGATION_TIMEOUT,
            'Target navigation timed out',
          );
        }

        throw new ScanExecutionError(
          ScanFailureCode.NAVIGATION_FAILED,
          'Target navigation failed',
        );
      }

      const navigationDurationMs = performance.now() - startedAt;

      /*
       * Allow the load event to complete,
       * but don't let it block the scan
       * indefinitely.
       */
      await page
        .waitForLoadState('load', {
          timeout: 10_000,
        })
        .catch(() => undefined);

      /*
       * Observation period for:
       *
       * LCP
       * layout shifts
       * long tasks
       * late resources
       */
      await page.waitForTimeout(DESKTOP_PROFILE.observationWindowMs);

      const finalUrl = page.url();

      /*
       * Validate final destination again.
       */
      await this.targetValidator.validate(finalUrl);

      /*
       * Collect performance while the page
       * still exists.
       */
      const performanceObservation =
        await this.performanceCollector.collect(page);

      const browserVersion = browser.version();

      const userAgent = await page.evaluate(() => navigator.userAgent);

      return {
        browser: {
          name: 'chromium',
          version: browserVersion,
          userAgent,
        },

        navigation: {
          requestedUrl: targetUrl,

          finalUrl,

          status: response?.status() ?? null,

          durationMs: navigationDurationMs,
        },

        documentResponse,

        requests,

        consoleMessages,

        performance: performanceObservation,
      };
    } finally {
      await context.close().catch(() => undefined);
    }
  }

  private sanitizeHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    const blocked = new Set([
      'authorization',
      'proxy-authorization',
      'cookie',
      'set-cookie',
    ]);

    return Object.fromEntries(
      Object.entries(headers).filter(
        ([key]) => !blocked.has(key.toLowerCase()),
      ),
    );
  }

  private sanitizeConsoleText(value: string): string {
    return value.slice(0, 2_000);
  }
}
