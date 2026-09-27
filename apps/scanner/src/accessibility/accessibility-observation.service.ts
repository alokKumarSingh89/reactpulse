import { Injectable } from '@nestjs/common';
import axe, { type AxeResults, type RunOptions } from 'axe-core';
import type { Frame, Page } from 'playwright';
import { ACCESSIBILITY_RULE_IDS } from '@reactpulse/contracts';

export const ACCESSIBILITY_TIMEOUT_MS = 10_000;
const MAX_NODES = 20_000;
export const ACCESSIBILITY_ENGINE_OPTIONS: RunOptions = {
  runOnly: { type: 'rule', values: [...ACCESSIBILITY_RULE_IDS] },
  iframes: false,
  preload: false,
  performanceTimer: false,
  elementRef: false,
};

// Scanner-private, transient output. Never serialize this wrapper to evidence,
// logs, a job result, or an API. Task 13.4 owns safe normalized projection.
export type AccessibilityObservation = {
  engine: 'axe-core';
  engineVersion: string;
  rulesetVersion: 1;
  scope: 'MAIN_DOCUMENT';
  durationMs: number;
  excludedFrameCount: number;
} & (
  | { state: 'SUCCEEDED'; raw: AxeResults }
  | {
      state: 'UNAVAILABLE';
      reason:
        | 'ENGINE_TIMEOUT'
        | 'ENGINE_UNAVAILABLE'
        | 'PAGE_CONTEXT_UNAVAILABLE'
        | 'NODE_LIMIT_REACHED'
        | 'NAVIGATION_CHANGED';
    }
);

@Injectable()
export class AccessibilityObservationService {
  async collect(
    page: Page,
    expectedUrl: string,
  ): Promise<AccessibilityObservation> {
    const started = performance.now();
    let excludedFrameCount = 0;
    let changed = false;
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onNavigation = (frame: Frame) => {
      if (frame === page.mainFrame()) changed = true;
    };
    const metadata = () => ({
      engine: 'axe-core' as const,
      engineVersion: axe.version,
      rulesetVersion: 1 as const,
      scope: 'MAIN_DOCUMENT' as const,
      durationMs: Math.min(120_000, Math.max(0, performance.now() - started)),
      excludedFrameCount,
    });
    type Outcome =
      | { state: 'SUCCEEDED'; raw: AxeResults }
      | {
          state: 'UNAVAILABLE';
          reason: Extract<
            AccessibilityObservation,
            { state: 'UNAVAILABLE' }
          >['reason'];
        };
    const unavailable = (
      reason: Extract<Outcome, { state: 'UNAVAILABLE' }>['reason'],
    ): Outcome => ({ state: 'UNAVAILABLE', reason });
    page.on('framenavigated', onNavigation);
    try {
      if (page.isClosed())
        return { ...metadata(), ...unavailable('PAGE_CONTEXT_UNAVAILABLE') };
      if (page.url() !== expectedUrl)
        return { ...metadata(), ...unavailable('NAVIGATION_CHANGED') };
      const execution = (async (): Promise<Outcome> => {
        // Bounded traversal, including open shadow roots, without reading text,
        // attributes or frame content. No large querySelectorAll allocation.
        const preflight = await page.evaluate((limit) => {
          let count = 0,
            frames = 0;
          const roots: (Document | ShadowRoot)[] = [document];
          while (roots.length) {
            const walker = document.createTreeWalker(
              roots.pop()!,
              NodeFilter.SHOW_ELEMENT,
            );
            let node: Node | null;
            while ((node = walker.nextNode())) {
              if (++count > limit)
                return { exceeded: true, frames: Math.min(frames, 1000) };
              const element = node as Element;
              if (element.tagName === 'IFRAME' || element.tagName === 'FRAME')
                frames++;
              if (element.shadowRoot) roots.push(element.shadowRoot);
            }
          }
          return { exceeded: false, frames: Math.min(frames, 1000) };
        }, MAX_NODES);
        if (
          !preflight ||
          typeof preflight.exceeded !== 'boolean' ||
          !Number.isSafeInteger(preflight.frames) ||
          preflight.frames < 0 ||
          preflight.frames > 1000
        )
          return unavailable('ENGINE_UNAVAILABLE');
        excludedFrameCount = preflight.frames;
        if (preflight.exceeded) return unavailable('NODE_LIMIT_REACHED');
        if (timedOut) return unavailable('ENGINE_TIMEOUT');
        if (changed) return unavailable('NAVIGATION_CHANGED');
        // Trusted locally installed source, never a target-provided script/URL.
        await page.evaluate(axe.source);
        const raw = await page.evaluate(async (options) => {
          const engine = (window as unknown as { axe: typeof axe }).axe;
          return engine.run(document, options);
        }, ACCESSIBILITY_ENGINE_OPTIONS);
        if (changed || page.url() !== expectedUrl)
          return unavailable('NAVIGATION_CHANGED');
        return { state: 'SUCCEEDED', raw };
      })().catch(() =>
        unavailable(
          timedOut
            ? 'ENGINE_TIMEOUT'
            : changed
              ? 'NAVIGATION_CHANGED'
              : page.isClosed()
                ? 'PAGE_CONTEXT_UNAVAILABLE'
                : 'ENGINE_UNAVAILABLE',
        ),
      );
      const deadline = new Promise<Outcome>((resolve) => {
        timeout = setTimeout(() => {
          timedOut = true;
          // A race alone cannot stop JS. Close this disposable context to cancel
          // engine work; all other intelligence has already been captured.
          void page
            .context()
            .close()
            .catch(() => undefined);
          resolve(unavailable('ENGINE_TIMEOUT'));
        }, ACCESSIBILITY_TIMEOUT_MS);
      });
      const outcome = await Promise.race([execution, deadline]);
      return { ...metadata(), ...outcome };
    } finally {
      if (timeout) clearTimeout(timeout);
      page.off('framenavigated', onNavigation);
    }
  }
}
