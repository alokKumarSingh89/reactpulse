import { afterEach, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import { chromium, type Page } from 'playwright';
import {
  AccessibilityObservationService,
  ACCESSIBILITY_ENGINE_OPTIONS,
  ACCESSIBILITY_TIMEOUT_MS,
} from './accessibility-observation.service';
import { projectSafeEvidence } from '../evidence/safe-evidence';

const canaries = [
  'accessibility-email-canary@example.com',
  'accessibility-token-canary-9182',
  'accessibility-input-secret-7712',
  'accessibility-dom-text-secret-6631',
  'accessibility-id-secret-5520',
];
function setup() {
  const close = vi.fn().mockResolvedValue(undefined);
  const raw = {
    violations: [{ html: canaries.join(' '), target: [canaries[4]] }],
  };
  const page = {
    on: vi.fn(),
    off: vi.fn(),
    mainFrame: () => 'main',
    isClosed: () => false,
    url: () => 'https://example.com/',
    context: () => ({ close }),
    evaluate: vi
      .fn()
      .mockResolvedValueOnce({ exceeded: false, frames: 2 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(raw),
  };
  return {
    page,
    close,
    raw,
    run: () =>
      new AccessibilityObservationService().collect(
        page as unknown as Page,
        'https://example.com/',
      ),
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe('AccessibilityObservationService', () => {
  it('uses local engine source and fixed main-document options; raw output remains private', async () => {
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    const h = setup();
    const result = await h.run();
    expect(result).toMatchObject({
      state: 'SUCCEEDED',
      engineVersion: axe.version,
      scope: 'MAIN_DOCUMENT',
      excludedFrameCount: 2,
      raw: h.raw,
    });
    expect(h.page.evaluate.mock.calls[1]).toEqual([axe.source]);
    expect(h.page.evaluate.mock.calls[2][1]).toEqual(
      ACCESSIBILITY_ENGINE_OPTIONS,
    );
    expect(ACCESSIBILITY_ENGINE_OPTIONS).toMatchObject({
      iframes: false,
      preload: false,
      performanceTimer: false,
    });
    expect(h.page.off).toHaveBeenCalledWith(
      'framenavigated',
      expect.any(Function),
    );
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    for (const canary of canaries)
      expect(
        JSON.stringify(projectSafeEvidence({ accessibility: result })),
      ).not.toContain(canary);
  });
  it('contains raw engine exceptions', async () => {
    const h = setup();
    h.page.evaluate
      .mockReset()
      .mockRejectedValue(new Error(canaries.join(' ')));
    const result = await h.run();
    expect(result).toMatchObject({
      state: 'UNAVAILABLE',
      reason: 'ENGINE_UNAVAILABLE',
    });
    expect(JSON.stringify(result)).not.toContain('canary');
  });
  it('bounds even malformed page-supplied operational metadata', async () => {
    const h = setup();
    h.page.evaluate
      .mockReset()
      .mockResolvedValue({ exceeded: false, frames: Infinity });
    expect(await h.run()).toMatchObject({
      state: 'UNAVAILABLE',
      reason: 'ENGINE_UNAVAILABLE',
      excludedFrameCount: 0,
    });
  });
  it('does not execute in a closed page or a changed URL', async () => {
    const h = setup();
    h.page.isClosed = () => true;
    expect(await h.run()).toMatchObject({ reason: 'PAGE_CONTEXT_UNAVAILABLE' });
    expect(h.page.evaluate).not.toHaveBeenCalled();
    h.page.isClosed = () => false;
    h.page.url = () => 'https://example.com/changed';
    expect(await h.run()).toMatchObject({ reason: 'NAVIGATION_CHANGED' });
    expect(h.page.evaluate).not.toHaveBeenCalled();
  });
  it('rejects oversized DOM without injecting the engine', async () => {
    const h = setup();
    h.page.evaluate
      .mockReset()
      .mockResolvedValue({ exceeded: true, frames: 0 });
    expect(await h.run()).toMatchObject({
      state: 'UNAVAILABLE',
      reason: 'NODE_LIMIT_REACHED',
    });
    expect(h.page.evaluate).toHaveBeenCalledOnce();
  });
  it('closes the disposable context on timeout instead of leaving engine work running', async () => {
    vi.useFakeTimers();
    const h = setup();
    h.page.evaluate.mockReset().mockReturnValue(new Promise(() => {}));
    const result = h.run();
    await vi.advanceTimersByTimeAsync(ACCESSIBILITY_TIMEOUT_MS);
    expect(await result).toMatchObject({
      state: 'UNAVAILABLE',
      reason: 'ENGINE_TIMEOUT',
    });
    expect(h.close).toHaveBeenCalledOnce();
    expect(h.page.off).toHaveBeenCalledOnce();
  });
  it('discards results when the main document navigates, including same-URL reloads', async () => {
    const h = setup();
    h.page.evaluate.mockReset().mockImplementation(async () => {
      h.page.on.mock.calls[0][1]('main');
      return { exceeded: false, frames: 0 };
    });
    expect(await h.run()).toMatchObject({
      state: 'UNAVAILABLE',
      reason: 'NAVIGATION_CHANGED',
    });
  });
  it('runs the pinned engine against real hostile DOM without analyzing child frames or navigating', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(
        `<html lang="en"><head><title>Fixture</title></head><body><main><input id="${canaries[4]}" value="${canaries[2]}"><p>${canaries[0]} ${canaries[3]}</p><a href="/reset?token=${canaries[1]}">Reset</a><iframe srcdoc="<button></button>"></iframe></main></body></html>`,
      );
      const navigation = vi.spyOn(page, 'goto');
      const reload = vi.spyOn(page, 'reload');
      const newPage = vi.spyOn(context, 'newPage');
      const requests: string[] = [];
      page.on('request', (request) => requests.push(request.url()));
      const result = await new AccessibilityObservationService().collect(
        page,
        page.url(),
      );
      expect(result.state).toBe('SUCCEEDED');
      if (result.state !== 'SUCCEEDED')
        throw new Error('Engine fixture failed');
      expect(result.raw.violations.some((rule) => rule.id === 'label')).toBe(
        true,
      );
      expect(
        result.raw.violations.some((rule) => rule.id === 'button-name'),
      ).toBe(false);
      expect(result.excludedFrameCount).toBe(1);
      expect(navigation).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
      expect(newPage).not.toHaveBeenCalled();
      expect(requests).toEqual([]);
      expect(JSON.stringify(result.raw)).toContain(canaries[4]);
      for (const canary of canaries)
        expect(
          JSON.stringify(projectSafeEvidence({ accessibility: result })),
        ).not.toContain(canary);
    } finally {
      await browser.close();
    }
  }, 20_000);
});
