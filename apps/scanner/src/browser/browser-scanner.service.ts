import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, type Browser } from 'playwright';

import { ScanExecutionError, ScanFailureCode } from '../scans/scan-failure';
import { TargetValidatorService } from '../security/target-validator.service';
import type {
  BrowserScanResult,
  ConsoleEvidence,
  DocumentResponseEvidence,
} from './browser.types';
import { PerformanceCollectorService } from '../performance/performance-collector.service';
import { NetworkCollectorService } from '../network/network-collector.service';

@Injectable()
export class BrowserScannerService {
  constructor(
    private readonly config: ConfigService,
    private readonly targetValidator: TargetValidatorService,
    private readonly performanceCollector: PerformanceCollectorService,
    private readonly networkCollector: NetworkCollectorService,
  ) {}

  async scan(targetUrl: string): Promise<BrowserScanResult> {
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
      viewport: {
        width: 1440,
        height: 900,
      },

      ignoreHTTPSErrors: false,

      acceptDownloads: false,

      serviceWorkers: 'block',
    });

    try {
      const page = await context.newPage();

      const consoleMessages: ConsoleEvidence[] = [];

      let documentResponse: DocumentResponseEvidence | null = null;

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

        documentResponse = {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          headers: this.sanitizeHeaders(await response.allHeaders()),
        };
      });

      /*
       * Validate every browser request.
       *
       * This catches redirect destinations
       * and subresource requests at the
       * application layer.
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
      const networkCollection = this.networkCollector.attach(page, targetUrl);
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

      const durationMs = performance.now() - startedAt;

      const finalUrl = page.url();

      /*
       * Explicit final validation gives us
       * another redirect-chain boundary.
       */
      await this.targetValidator.validate(finalUrl);
      const performanceObservation =
        await this.performanceCollector.collect(page);
      const network = await networkCollection.getObservation();
      const browserVersion = browser.version();

      const userAgent = await page.evaluate(() => navigator.userAgent);
      const navigationStartedAt = performance.now();
      const navigationDurationMs = performance.now() - navigationStartedAt;

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

        consoleMessages,

        performance: performanceObservation,
        network,
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
