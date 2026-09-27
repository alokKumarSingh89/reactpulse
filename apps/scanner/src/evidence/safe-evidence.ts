import type { Prisma, ScanEvidenceType } from '@reactpulse/database';
import {
  projectSafeUrlOrigin,
  sanitizeNetworkUrl,
} from '../network/network-url-sanitizer';

const MAX_ENTRIES = 5000;
const MAX_CONSOLE = 1000;
const RESOURCE_TYPES = [
  'document',
  'stylesheet',
  'image',
  'media',
  'font',
  'script',
  'texttrack',
  'xhr',
  'fetch',
  'eventsource',
  'websocket',
  'manifest',
  'other',
];
type SafeObject = { [key: string]: Prisma.InputJsonValue | null };
export interface SafeEvidenceRow {
  type: ScanEvidenceType;
  sequence: number;
  data: SafeObject;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function list(value: unknown, limit = MAX_ENTRIES): unknown[] {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}
function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
function integer(value: unknown): number | null {
  const n = number(value);
  return n !== null && Number.isSafeInteger(n) ? n : null;
}
function status(value: unknown): number | null {
  const n = integer(value);
  return n !== null && n >= 100 && n <= 599 ? n : null;
}
function choice(
  value: unknown,
  allowed: readonly string[],
  fallback: string,
): string {
  return typeof value === 'string' && allowed.includes(value)
    ? value
    : fallback;
}
function url(value: unknown, origin = false): string {
  const input = typeof value === 'string' ? value : '';
  return origin ? projectSafeUrlOrigin(input) : sanitizeNetworkUrl(input);
}
function cacheControl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  // Keep recognized cache policy only; quoted field names/extensions are omitted.
  const directives = value
    .toLowerCase()
    .split(',')
    .slice(0, 32)
    .map((part) => part.trim())
    .filter(
      (part) =>
        /^(?:public|private|no-cache|no-store|must-revalidate|proxy-revalidate|immutable|no-transform)$/.test(
          part,
        ) ||
        /^(?:max-age|s-maxage|stale-while-revalidate|stale-if-error)=[0-9]{1,10}$/.test(
          part,
        ),
    );
  return directives.length ? [...new Set(directives)].join(', ') : null;
}
function contentType(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 1024) return null;
  const type = value.split(';', 1)[0].trim().toLowerCase();
  return (
    choice(
      type,
      [
        'text/html',
        'text/plain',
        'text/css',
        'text/javascript',
        'application/javascript',
        'application/json',
        'application/xhtml+xml',
        'application/octet-stream',
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'image/svg+xml',
        'image/avif',
        'font/woff',
        'font/woff2',
      ],
      '',
    ) || null
  );
}

/** Explicit projection only. Never spread input or stringify it as a fallback.
 * Malformed numeric fields become null; malformed indexed entries are dropped.
 * Limits bound persistence, not collection. Input objects are never mutated.
 */
export function projectSafeEvidence(input: unknown): SafeEvidenceRow[] {
  const result = record(input);
  const rows: SafeEvidenceRow[] = [];
  const add = (type: ScanEvidenceType, data: SafeObject, sequence = 0) =>
    rows.push({ type, sequence, data });
  const browser = record(result.browser);
  add('BROWSER', {
    name: choice(browser.name, ['chromium', 'firefox', 'webkit'], 'unknown'),
    version:
      typeof browser.version === 'string' &&
      /^[0-9]{1,4}(?:\.[0-9]{1,6}){0,3}$/.test(browser.version)
        ? browser.version
        : null,
    // A page-controlled user-agent may contain secrets; omission is intentional.
  });
  const navigation = record(result.navigation);
  add('NAVIGATION', {
    requestedUrl: url(navigation.requestedUrl, true),
    finalUrl: url(navigation.finalUrl, true),
    status: status(navigation.status),
    durationMs: number(navigation.durationMs),
  });
  if (result.documentResponse != null) {
    const document = record(result.documentResponse);
    add('DOCUMENT_RESPONSE', {
      url: url(document.url, true),
      status: status(document.status),
    });
  }
  const network = record(result.network);
  for (const [key, type] of [
    ['requests', 'NETWORK_REQUEST'],
    ['responses', 'NETWORK_RESPONSE'],
    ['failures', 'NETWORK_FAILURE'],
  ] as const) {
    const seen = new Set<number>();
    for (const entry of list(network[key])) {
      const item = record(entry);
      const sequence = integer(item.sequence);
      if (sequence === null || sequence > 2147483647 || seen.has(sequence))
        continue;
      const requestSequence = integer(item.requestSequence);
      if (
        type !== 'NETWORK_REQUEST' &&
        (requestSequence === null || requestSequence > 2147483647)
      )
        continue;
      seen.add(sequence);
      const safeUrl = url(item.url);
      let domain: string | null = null;
      try {
        domain = new URL(safeUrl).hostname;
      } catch {
        /* Safe fallback. */
      }
      const data: SafeObject = {
        sequence,
        url: safeUrl,
        domain,
        resourceType: choice(item.resourceType, RESOURCE_TYPES, 'other'),
        party: choice(
          item.party,
          ['FIRST_PARTY', 'THIRD_PARTY'],
          'THIRD_PARTY',
        ),
      };
      if (type === 'NETWORK_RESPONSE') {
        const responseStatus = status(item.status);
        if (responseStatus === null) continue;
        Object.assign(data, {
          requestSequence,
          status: responseStatus,
          statusText: '',
          durationMs: number(item.durationMs),
          transferSize: integer(item.transferSize),
          encodedBodySize: integer(item.encodedBodySize),
          decodedBodySize: integer(item.decodedBodySize),
          fromServiceWorker: item.fromServiceWorker === true,
          cacheControl: cacheControl(item.cacheControl),
          contentType: contentType(item.contentType),
        });
      } else {
        data.method = choice(
          item.method,
          [
            'GET',
            'HEAD',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS',
            'CONNECT',
            'TRACE',
          ],
          'UNKNOWN',
        );
        if (type === 'NETWORK_REQUEST')
          data.startedAtMs = number(item.startedAtMs);
        else Object.assign(data, { requestSequence, failureText: null });
      }
      add(type, data, sequence);
    }
  }
  list(result.consoleMessages, MAX_CONSOLE).forEach((entry, sequence) => {
    add(
      'CONSOLE',
      {
        type: choice(
          record(entry).type,
          [
            'log',
            'debug',
            'info',
            'error',
            'warning',
            'warn',
            'assert',
            'trace',
            'clear',
            'count',
            'timeEnd',
            'startGroup',
            'startGroupCollapsed',
            'endGroup',
            'table',
            'dir',
            'dirxml',
          ],
          'unknown',
        ),
      },
      sequence,
    );
  });
  const performance = record(result.performance);
  const metrics = record(performance.metrics);
  const safeMetrics: SafeObject = {};
  for (const key of [
    'ttfbMs',
    'fcpMs',
    'lcpMs',
    'cls',
    'domContentLoadedMs',
    'loadEventMs',
    'navigationDurationMs',
    'longTaskDurationMs',
    'totalBlockingTimeMs',
  ])
    safeMetrics[key] = number(metrics[key]);
  for (const key of ['longTaskCount', 'domNodes'])
    safeMetrics[key] = integer(metrics[key]);
  const resources = record(metrics.resources);
  safeMetrics.resources = {
    count: integer(resources.count),
    transferSize: integer(resources.transferSize),
    encodedBodySize: integer(resources.encodedBodySize),
    decodedBodySize: integer(resources.decodedBodySize),
  };
  safeMetrics.layoutShifts = list(metrics.layoutShifts).flatMap((entry) => {
    const item = record(entry);
    const value = number(item.value),
      startTime = number(item.startTime);
    return value !== null &&
      startTime !== null &&
      typeof item.hadRecentInput === 'boolean'
      ? [{ value, startTime, hadRecentInput: item.hadRecentInput }]
      : [];
  });
  add('PERFORMANCE', safeMetrics);
  list(performance.longTasks).forEach((entry, sequence) => {
    const item = record(entry);
    const startTime = number(item.startTime),
      duration = number(item.duration);
    if (startTime !== null && duration !== null)
      add('LONG_TASK', { startTime, duration }, sequence);
  });
  return rows;
}
