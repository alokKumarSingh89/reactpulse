import { EventEmitter } from 'node:events';
import { ConfigService } from '@nestjs/config';
import type { Page } from 'playwright';
import { expect, it } from 'vitest';
import { NetworkCollectorService } from './network-collector.service';

it('detaches its listeners, drains accepted responses, and returns detached observations', async () => {
  const page = new EventEmitter();
  const unrelated = () => {};
  page.on('request', unrelated);
  const collection = new NetworkCollectorService(
    new ConfigService({ SCANNER_MAX_REQUESTS: 10 }),
  ).attach(page as unknown as Page, 'https://example.com');
  const request = {
    url: () => 'https://example.com/a',
    method: () => 'GET',
    resourceType: () => 'script',
    sizes: async () => null,
  };
  page.emit('request', request);
  let release!: (value: Record<string, string>) => void;
  page.emit('response', {
    request: () => request,
    url: request.url,
    allHeaders: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    status: () => 200,
    statusText: () => 'OK',
    fromServiceWorker: () => false,
  });
  const finishing = collection.getObservation();
  page.emit('request', request);
  release({});
  const result = await finishing;
  expect(result.requests).toHaveLength(1);
  expect(result.responses).toHaveLength(1);
  expect(page.listeners('request')).toEqual([unrelated]);
  expect(page.listenerCount('response')).toBe(0);
  expect(page.listenerCount('requestfailed')).toBe(0);
  result.requests[0].url = 'changed';
  expect((await collection.getObservation()).requests[0].url).toBe(
    'https://example.com/a',
  );
});
