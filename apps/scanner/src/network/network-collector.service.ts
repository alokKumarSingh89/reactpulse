import { Injectable } from '@nestjs/common';

import type { Page, Request, Response } from 'playwright';

import { classifyNetworkParty } from './network-party';

import { sanitizeNetworkUrl } from './network-url-sanitizer';

import type {
  NetworkFailureObservation,
  NetworkObservation,
  NetworkRequestObservation,
  NetworkResponseObservation,
} from './network.types';
import { ConfigService } from '@nestjs/config';

interface TrackedRequest {
  sequence: number;
  startedAt: number;
}

@Injectable()
export class NetworkCollectorService {
  private readonly maxRequests: number;
  constructor(configService: ConfigService) {
    this.maxRequests = configService.getOrThrow<number>('SCANNER_MAX_REQUESTS');
  }

  attach(
    page: Page,
    targetUrl: string,
  ): {
    getObservation: () => Promise<NetworkObservation>;
  } {
    const requests: NetworkRequestObservation[] = [];

    const responses: NetworkResponseObservation[] = [];

    const failures: NetworkFailureObservation[] = [];

    const tracked = new Map<Request, TrackedRequest>();

    const pending = new Set<Promise<void>>();

    let requestSequence = 0;

    let responseSequence = 0;

    let failureSequence = 0;

    page.on('request', (request) => {
      if (requests.length >= this.maxRequests) {
        return;
      }

      const sequence = requestSequence++;

      tracked.set(request, {
        sequence,
        startedAt: performance.now(),
      });

      const rawUrl = request.url();

      requests.push({
        sequence,

        url: sanitizeNetworkUrl(rawUrl),

        method: request.method(),

        resourceType: request.resourceType(),

        domain: getHostname(rawUrl),

        party: classifyNetworkParty(targetUrl, rawUrl),

        startedAtMs: performance.now(),
      });
    });

    page.on('response', (response) => {
      const task = this.captureResponse(
        response,
        targetUrl,
        tracked,
        responses,
        responseSequence++,
      );

      pending.add(task);

      void task.finally(() => {
        pending.delete(task);
      });
    });

    page.on('requestfailed', (request) => {
      if (failures.length >= this.maxRequests) {
        return;
      }

      const trackedRequest = tracked.get(request);

      if (!trackedRequest) {
        return;
      }

      const rawUrl = request.url();

      failures.push({
        sequence: failureSequence++,

        requestSequence: trackedRequest.sequence,

        url: sanitizeNetworkUrl(rawUrl),

        method: request.method(),

        resourceType: request.resourceType(),

        domain: getHostname(rawUrl),

        party: classifyNetworkParty(targetUrl, rawUrl),

        failureText: sanitizeFailureText(request.failure()?.errorText ?? null),
      });
    });

    return {
      getObservation: async () => {
        await Promise.allSettled(Array.from(pending));

        return {
          requests,
          responses,
          failures,
        };
      },
    };
  }

  private async captureResponse(
    response: Response,
    targetUrl: string,

    tracked: Map<Request, TrackedRequest>,

    responses: NetworkResponseObservation[],

    sequence: number,
  ): Promise<void> {
    if (responses.length >= this.maxRequests) {
      return;
    }

    const request = response.request();

    const trackedRequest = tracked.get(request);

    if (!trackedRequest) {
      return;
    }

    const rawUrl = response.url();

    const headers: Record<string, string> = await response
      .allHeaders()
      .catch((): Record<string, string> => ({}));

    const sizes = await response
      .request()
      .sizes()
      .catch(() => null);

    responses.push({
      sequence,

      requestSequence: trackedRequest.sequence,

      url: sanitizeNetworkUrl(rawUrl),

      status: response.status(),

      statusText: response.statusText(),

      domain: getHostname(rawUrl),

      party: classifyNetworkParty(targetUrl, rawUrl),

      resourceType: request.resourceType(),

      durationMs: Math.max(0, performance.now() - trackedRequest.startedAt),

      transferSize: sizes
        ? sizes.responseBodySize + sizes.responseHeadersSize
        : null,

      encodedBodySize: sizes ? sizes.responseBodySize : null,

      decodedBodySize: null,

      fromServiceWorker: response.fromServiceWorker(),

      cacheControl: headers['cache-control'] ?? null,

      contentType: headers['content-type'] ?? null,
    });
  }
}

function getHostname(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function sanitizeFailureText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.slice(0, 500);
}
