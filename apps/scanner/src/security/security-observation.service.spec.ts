import { describe, expect, it, vi } from 'vitest';
import type { Page, Response, Request } from 'playwright';
import {
  observeSecurityHeaders,
  SecurityObservationService,
} from './security-observation.service';

const secret = 'SECRET_CANARY_abc';
const parse = (headers: Record<string, string>) =>
  observeSecurityHeaders(
    Object.entries(headers).map(([name, value]) => ({ name, value })),
    0,
    false,
  );
function harness() {
  const main = {};
  let listener: (response: Response) => void;
  const page = {
    mainFrame: () => main,
    on: vi.fn((_event, callback) => {
      listener = callback;
    }),
    off: vi.fn(),
  };
  const collection = new SecurityObservationService().attach(
    page as unknown as Page,
    `http://user:${secret}@example.com/?q=${secret}#${secret}`,
  );
  function response(
    url: string,
    status = 200,
    headers: Promise<{ name: string; value: string }[]> = Promise.resolve([]),
    frame = main,
    previous: Request | null = null,
  ) {
    const request = {
      resourceType: () => 'document',
      isNavigationRequest: () => true,
      frame: () => frame,
      redirectedFrom: () => previous,
    } as unknown as Request;
    const result = {
      request: () => request,
      url: () => url,
      status: () => status,
      headersArray: () => headers,
    } as unknown as Response;
    listener(result);
    return request;
  }
  return { collection, response, page };
}

describe('passive main-document observation', () => {
  it('ignores iframe documents and preserves redirect event order despite header completion order', async () => {
    const h = harness();
    let resolve!: (headers: { name: string; value: string }[]) => void;
    const first = h.response(
      `http://example.com/?q=${secret}`,
      302,
      new Promise((r) => {
        resolve = r;
      }),
    );
    h.response(
      'https://example.com/final',
      200,
      Promise.resolve([]),
      undefined,
      first,
    );
    h.response(
      'https://iframe.example/',
      200,
      Promise.resolve([{ name: 'x-frame-options', value: 'DENY' }]),
      {},
    );
    resolve([
      { name: 'Location', value: `https://example.com/${secret}` },
      { name: 'Set-Cookie', value: `${secret}=${secret}; Secure` },
    ]);
    const result = await h.collection.getObservation(
      'https://example.com/final',
    );
    expect(result.mainDocumentResponses).toEqual([
      {
        ordinal: 0,
        redirectedFromOrdinal: null,
        scheme: 'HTTP',
        status: 302,
        site: { ordinal: 0 },
      },
      {
        ordinal: 1,
        redirectedFromOrdinal: 0,
        scheme: 'HTTPS',
        status: 200,
        site: { ordinal: 1 },
      },
    ]);
    expect(result.assessment.navigation).toMatchObject({
      facts: { transportState: 'HTTP_TO_HTTPS_OBSERVED' },
    });
    expect(result.assessment.mainDocument).toMatchObject({
      state: 'OBSERVED',
      facts: { status: 200 },
    });
    expect(result.assessment.framing.xFrameOptions).toEqual({
      presence: 'ABSENT',
    });
    expect(result.assessment.cookies).toMatchObject({
      facts: [
        {
          documentResponseOrdinal: 0,
          scope: 'MAIN_DOCUMENT_REDIRECT_RESPONSE',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(h.page.off).toHaveBeenCalledOnce();
  });
  it('marks missing headers/cookies unavailable and does not reject collection', async () => {
    const h = harness();
    h.response('https://example.com/', 200, Promise.reject(new Error(secret)));
    const { assessment } = await h.collection.getObservation(
      'https://example.com/',
    );
    expect(assessment.csp.enforced.presence).toBe('UNAVAILABLE');
    expect(assessment.cookies.state).toBe('UNAVAILABLE');
    expect(assessment.coverage.reasons).toContain('HEADERS_UNAVAILABLE');
    expect(JSON.stringify(assessment)).not.toContain(secret);
  });
  it('bounds main document observations and marks changed navigation uncertain', async () => {
    const h = harness();
    for (let i = 0; i < 40; i++) h.response('https://example.com/');
    const result = await h.collection.getObservation(
      'https://example.com/changed',
    );
    expect(result.mainDocumentResponses).toHaveLength(32);
    expect(result.assessment.coverage.reasons).toContain(
      'OBSERVATION_LIMIT_REACHED',
    );
    expect(result.assessment.mainDocument.state).toBe('UNAVAILABLE');
    expect(result.assessment.navigation).toMatchObject({
      facts: { transportState: 'UNCERTAIN' },
    });
  });
  it('reports no main document as unavailable', async () => {
    const { assessment } = await harness().collection.getObservation(
      'https://example.com/',
    );
    expect(assessment.coverage.state).toBe('UNAVAILABLE');
  });
});

describe('safe header facts', () => {
  it('discards nonce/hash/reporting targets and arbitrary/credential headers', () => {
    const result = parse({
      'Content-Security-Policy': `script-src 'self' 'nonce-${secret}' 'sha256-${secret}'; frame-ancestors 'none'; report-uri https://reports.test/${secret}; report-to ${secret}`,
      'X-Custom': secret,
      Authorization: secret,
      'Proxy-Authorization': secret,
      Cookie: secret,
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.csp.enforced).toMatchObject({
      facts: [
        {
          directives: [
            {
              directive: 'script-src',
              sources: ['SELF', 'NONCE_PRESENT', 'HASH_PRESENT'],
            },
            { directive: 'frame-ancestors', sources: ['NONE'] },
          ],
        },
      ],
    });
    expect(result.framing.frameAncestors).toEqual({
      state: 'OBSERVED',
      facts: { state: 'PRESENT', policyOrdinals: [0] },
    });
  });
  it('does not infer enforced frame protection from default-src or report-only CSP', () => {
    const result = parse({
      'content-security-policy': "default-src 'none'",
      'content-security-policy-report-only': "frame-ancestors 'none'",
    });
    expect(result.csp.reportOnly.presence).toBe('PRESENT');
    expect(result.framing.frameAncestors).toEqual({
      state: 'OBSERVED',
      facts: { state: 'ABSENT' },
    });
  });
  it.each(['', '\0secret', '???', 'script-src '.repeat(2000)])(
    'handles malformed/bounded CSP safely',
    (value) => {
      expect(() => parse({ 'content-security-policy': value })).not.toThrow();
      expect(
        parse({ 'content-security-policy': value }).csp.enforced,
      ).not.toHaveProperty('facts');
    },
  );
  it('keeps multiple CSP policies separate', () => {
    const result = observeSecurityHeaders(
      [
        { name: 'Content-Security-Policy', value: "script-src 'self'" },
        { name: 'Content-Security-Policy', value: "script-src 'none'" },
      ],
      0,
      false,
    );
    expect(result.csp.enforced).toMatchObject({
      facts: [{ ordinal: 0 }, { ordinal: 1 }],
    });
  });
  it.each([
    'max-age=-1',
    'max-age=Infinity',
    'max-age=99999999999999999',
    'max-age=3;max-age=4',
    'includeSubDomains',
    'max-age="3',
  ])('rejects invalid HSTS %s', (value) => {
    expect(parse({ 'strict-transport-security': value }).hsts).toEqual({
      presence: 'PRESENT',
      parseState: 'INVALID',
    });
  });
  it('preserves HSTS zero and recognized directives', () => {
    expect(
      parse({
        'strict-transport-security': 'max-age=0; includeSubDomains; preload',
      }).hsts,
    ).toMatchObject({
      parseState: 'PARSED',
      facts: { maxAgeSeconds: 0, includeSubDomains: true, preload: true },
    });
  });
  it('normalizes nosniff, referrer policies, and XFO without echoing unknown values', () => {
    const result = parse({
      'x-content-type-options': ' NoSniff ',
      'referrer-policy': `${secret}, strict-origin`,
      'x-frame-options': 'sameorigin',
    });
    expect(result.contentTypeOptions).toMatchObject({
      facts: { nosniff: true },
    });
    expect(result.referrerPolicy).toMatchObject({
      facts: { policy: 'strict-origin' },
    });
    expect(result.framing.xFrameOptions).toMatchObject({
      facts: { policy: 'SAMEORIGIN' },
    });
    const unknown = parse({
      'x-content-type-options': secret,
      'referrer-policy': secret,
      'x-frame-options': secret,
    });
    expect(unknown.referrerPolicy).toMatchObject({
      facts: { policy: 'UNKNOWN' },
    });
    expect(unknown.framing.xFrameOptions).toMatchObject({
      facts: { policy: 'UNKNOWN' },
    });
    expect(JSON.stringify(unknown)).not.toContain(secret);
    expect(
      parse({ 'x-frame-options': 'DENY, SAMEORIGIN' }).framing.xFrameOptions,
    ).toMatchObject({ facts: { policy: 'CONFLICTING' } });
  });
  it('uses conservative Permissions-Policy categories', () => {
    const result = parse({
      'permissions-policy': `camera=(), microphone=(self), fullscreen=*, geolocation=("https://${secret}.test"), unknown=(), malformed`,
    });
    expect(result.permissionsPolicy).toMatchObject({
      parseState: 'PARTIAL',
      facts: {
        hasUnrecognizedFeatures: true,
        features: [
          { feature: 'camera', allowlist: 'NONE' },
          { feature: 'microphone', allowlist: 'SELF' },
          { feature: 'fullscreen', allowlist: 'ALL' },
          { feature: 'geolocation', allowlist: 'UNKNOWN' },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
  it('uses separate Set-Cookie entries without splitting Expires commas and drops all identifiers', () => {
    const result = observeSecurityHeaders(
      [
        {
          name: 'Set-Cookie',
          value: `${secret}=${secret}; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Domain=${secret}; Path=/${secret}; Max-Age=100; Secure; HttpOnly; SameSite=None; Partitioned`,
        },
        { name: 'Set-Cookie', value: `${secret}=x` },
        { name: 'Set-Cookie', value: `x=${secret}; SameSite=${secret}` },
      ],
      2,
      false,
    );
    expect(result.cookies).toEqual({
      state: 'OBSERVED',
      facts: [
        {
          ordinal: 0,
          documentResponseOrdinal: 2,
          scope: 'MAIN_DOCUMENT_RESPONSE',
          secure: true,
          httpOnly: true,
          sameSite: 'NONE',
          partitioned: true,
        },
        {
          ordinal: 1,
          documentResponseOrdinal: 2,
          scope: 'MAIN_DOCUMENT_RESPONSE',
          secure: false,
          httpOnly: false,
          sameSite: 'ABSENT',
          partitioned: false,
        },
        {
          ordinal: 2,
          documentResponseOrdinal: 2,
          scope: 'MAIN_DOCUMENT_RESPONSE',
          secure: false,
          httpOnly: false,
          sameSite: 'INVALID',
          partitioned: false,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
  it('distinguishes absent cookies from unavailable and malformed observations', () => {
    expect(parse({}).cookies).toEqual({ state: 'OBSERVED', facts: [] });
    expect(observeSecurityHeaders(null, 0, false).cookies.state).toBe(
      'UNAVAILABLE',
    );
    expect(parse({ 'set-cookie': 'invalid' }).cookies.state).toBe('UNKNOWN');
    expect(parse({ 'set-cookie': 'x'.repeat(9000) }).cookies.state).toBe(
      'UNAVAILABLE',
    );
  });
});
