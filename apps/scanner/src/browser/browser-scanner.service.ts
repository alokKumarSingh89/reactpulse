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
import { PERFORMANCE_INIT_SCRIPT } from '../performance/performance-init-script';
import { SecurityObservationService } from '../security/security-observation.service';
import { DESKTOP_PROFILE } from './scan-profile';

@Injectable()
export class BrowserScannerService {
  constructor(
    private readonly config: ConfigService,
    private readonly targetValidator: TargetValidatorService,
    private readonly performanceCollector: PerformanceCollectorService,
    private readonly networkCollector: NetworkCollectorService,
    private readonly securityObserver: SecurityObservationService,
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
      await context.addInitScript({ content: PERFORMANCE_INIT_SCRIPT });
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

      const securityCollection = this.securityObserver.attach(page, targetUrl);
      page.on('response', (response) => {
        const request = response.request();
        if (
          request.resourceType() !== 'document' ||
          !request.isNavigationRequest() ||
          request.frame() !== page.mainFrame()
        ) {
          return;
        }

        documentResponse = {
          url: response.url(),
          status: response.status(),
          statusText: '',
          headers: {},
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

      let response;
      const networkCollection = this.networkCollector.attach(page, targetUrl);
      const startedAt = performance.now();
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

      const navigationUrl = page.url();

      /*
       * Explicit final validation gives us
       * another redirect-chain boundary.
       */
      await this.targetValidator.validate(navigationUrl);

      // Keep browser observers and network listeners active during observation.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, DESKTOP_PROFILE.observationWindowMs);
      });

      const finalUrl = page.url();
      await this.targetValidator.validate(finalUrl);
      const performanceObservation =
        await this.performanceCollector.collect(page);
      const network = await networkCollection.getObservation();
      const security = await securityCollection.getObservation(finalUrl);
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

          durationMs,
        },

        documentResponse,

        consoleMessages,

        security,
        performance: performanceObservation,
        network,
      };
    } finally {
      await context.close().catch(() => undefined);
    }
  }

  private sanitizeConsoleText(value: string): string {
    return value.slice(0, 2_000);
  }
}
