import { Injectable } from '@nestjs/common';
import type { Page, Response } from 'playwright';
import type {
  PassiveSecurityAssessment,
  SecurityHeaderObservation,
  SecurityCspDirective,
  SecurityCspSourceKind,
  SecurityCspPolicyFacts,
  SecurityCoverageReason,
  SecurityScheme,
  SecurityReferrerPolicy,
  SecurityPermissionFeature,
  PermissionsPolicySecurityFacts,
  CookieAttributeSecurityObservation,
} from '@reactpulse/contracts';
import { projectSafeUrlOrigin } from '../network/network-url-sanitizer';

const MAX_RESPONSES = 32;
const MAX_HEADERS = 256;
const MAX_VALUE = 8192;
type Headers = readonly { name: string; value: string }[];
const absent = { presence: 'ABSENT' } as const;
const invalid = { presence: 'PRESENT', parseState: 'INVALID' } as const;
const unsupported = { presence: 'PRESENT', parseState: 'UNSUPPORTED' } as const;
const unavailable = {
  presence: 'UNAVAILABLE',
  reason: 'HEADERS_UNAVAILABLE',
} as const;
function parsed<T>(facts: T, partial = false): SecurityHeaderObservation<T> {
  return {
    presence: 'PRESENT',
    parseState: partial ? 'PARTIAL' : 'PARSED',
    facts,
  };
}
const directives: readonly SecurityCspDirective[] = [
  'default-src',
  'script-src',
  'script-src-elem',
  'script-src-attr',
  'style-src',
  'object-src',
  'base-uri',
  'form-action',
  'frame-ancestors',
  'upgrade-insecure-requests',
  'block-all-mixed-content',
];
const sourceKinds: Record<string, SecurityCspSourceKind> = {
  "'none'": 'NONE',
  "'self'": 'SELF',
  '*': 'WILDCARD',
  'https:': 'HTTPS_SCHEME',
  'http:': 'HTTP_SCHEME',
  'data:': 'DATA_SCHEME',
  'blob:': 'BLOB_SCHEME',
  "'unsafe-inline'": 'UNSAFE_INLINE',
  "'unsafe-eval'": 'UNSAFE_EVAL',
  "'strict-dynamic'": 'STRICT_DYNAMIC',
};
function csp(
  values: string[],
): SecurityHeaderObservation<readonly SecurityCspPolicyFacts[]> {
  if (!values.length) return absent;
  if (
    values.length > 16 ||
    values.some((v) => v.length > MAX_VALUE || /[\r\n\0]/.test(v))
  )
    return unsupported;
  const policies: SecurityCspPolicyFacts[] = [];
  let partial = false;
  for (const value of values.flatMap((v) => v.split(','))) {
    if (policies.length >= 16) return unsupported;
    if (!value.trim()) return invalid;
    const facts: SecurityCspPolicyFacts['directives'][number][] = [];
    let unknown = false;
    const seen = new Set<string>();
    const parts = value.split(';');
    if (parts.length > 64) return unsupported;
    for (const part of parts) {
      if (!part.trim()) continue;
      const [name, ...tokens] = part.trim().split(/\s+/);
      const directive = name.toLowerCase();
      if (!/^[a-z][a-z0-9-]*$/.test(directive)) return invalid;
      if (seen.has(directive)) {
        partial = true;
        continue;
      }
      seen.add(directive);
      if (!directives.includes(directive as SecurityCspDirective)) {
        unknown = true;
        continue;
      }
      if (tokens.length > 128) return unsupported;
      const sources = tokens.map((token): SecurityCspSourceKind => {
        if (Object.hasOwn(sourceKinds, token)) return sourceKinds[token];
        if (/^'nonce-[A-Za-z0-9+/_=-]+'$/.test(token)) return 'NONCE_PRESENT';
        if (/^'sha(?:256|384|512)-[A-Za-z0-9+/_=-]+'$/.test(token))
          return 'HASH_PRESENT';
        if (
          /^(?:https?:\/\/)?(?:\*\.)?[a-z0-9.-]+(?::[0-9]+)?(?:\/[^\s]*)?$/i.test(
            token,
          )
        )
          return 'EXPLICIT_SOURCE_PRESENT';
        partial = true;
        return 'UNRECOGNIZED';
      });
      facts.push({
        directive: directive as SecurityCspDirective,
        sources: [...new Set(sources)],
      });
    }
    partial ||= unknown;
    policies.push({
      ordinal: policies.length,
      directives: facts,
      hasUnrecognizedDirectives: unknown,
    });
  }
  return parsed(policies, partial);
}
const referrers: readonly SecurityReferrerPolicy[] = [
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
];
const features: readonly SecurityPermissionFeature[] = [
  'camera',
  'microphone',
  'geolocation',
  'payment',
  'usb',
  'fullscreen',
  'display-capture',
  'clipboard-read',
  'clipboard-write',
];
function permissions(
  value: string,
): SecurityHeaderObservation<PermissionsPolicySecurityFacts> {
  const facts: PermissionsPolicySecurityFacts['features'][number][] = [];
  let unknown = false;
  const seen = new Set<string>();
  const parts = value.split(',');
  if (parts.length > 64) return unsupported;
  for (const part of parts) {
    const match = /^\s*([a-z-]+)\s*=\s*(\*|\([^()]*\))\s*$/.exec(part);
    if (!match) {
      unknown = true;
      continue;
    }
    const [, name, allow] = match;
    if (
      !features.includes(name as SecurityPermissionFeature) ||
      seen.has(name)
    ) {
      unknown = true;
      continue;
    }
    seen.add(name);
    // Deliberately don't interpret arbitrary origin lists or quoted grammar.
    const allowlist =
      allow === '*'
        ? 'ALL'
        : /^\(\s*\)$/.test(allow)
          ? 'NONE'
          : /^\(\s*self\s*\)$/.test(allow)
            ? 'SELF'
            : 'UNKNOWN';
    unknown ||= allowlist === 'UNKNOWN';
    facts.push({ feature: name as SecurityPermissionFeature, allowlist });
  }
  return parsed({ features: facts, hasUnrecognizedFeatures: unknown }, unknown);
}
function scheme(url: string): SecurityScheme {
  if (url.length > 16384) return 'UNKNOWN';
  try {
    const p = new URL(url).protocol;
    return p === 'https:' ? 'HTTPS' : p === 'http:' ? 'HTTP' : 'OTHER';
  } catch {
    return 'UNKNOWN';
  }
}
export interface MainDocumentHop {
  ordinal: number;
  redirectedFromOrdinal: number | null;
  scheme: SecurityScheme;
  status: number;
  site: { ordinal: number } | null;
}
export interface PassiveSecurityObservation {
  assessment: PassiveSecurityAssessment;
  /** Event order; references link observed redirects without retaining Location. */
  mainDocumentResponses: readonly MainDocumentHop[];
}

/** Parses transient headers into the existing contract; never returns raw input. */
export function observeSecurityHeaders(
  headers: Headers | null,
  responseOrdinal: number,
  redirect: boolean,
) {
  const bounded = headers !== null && headers.length <= MAX_HEADERS;
  const values = (name: string) =>
    bounded
      ? headers.filter((h) => h.name.toLowerCase() === name).map((h) => h.value)
      : [];
  function single<T>(
    name: string,
    parse: (value: string) => SecurityHeaderObservation<T>,
  ): SecurityHeaderObservation<T> {
    if (!bounded) return unavailable;
    const found = values(name);
    if (!found.length) return absent;
    if (found.some((v) => v.length > MAX_VALUE || /[\r\n\0]/.test(v)))
      return unsupported;
    const combined = found.join(',');
    return combined.length > MAX_VALUE ? unsupported : parse(combined);
  }
  const enforced = bounded
    ? csp(values('content-security-policy'))
    : unavailable;
  const reportOnly = bounded
    ? csp(values('content-security-policy-report-only'))
    : unavailable;
  const hsts = single('strict-transport-security', (value) => {
    let maxAgeSeconds: number | null = null;
    let includeSubDomains = false,
      preload = false,
      partial = false;
    const seen = new Set<string>();
    for (const part of value.split(';')) {
      const token = part.trim();
      const name = token.split('=', 1)[0].toLowerCase();
      if (seen.has(name)) return invalid;
      seen.add(name);
      if (name === 'max-age') {
        const match = /^max-age\s*=\s*"?([0-9]{1,15})"?$/i.exec(token);
        if (!match || !Number.isSafeInteger(Number(match[1]))) return invalid;
        // Quotes must be balanced.
        if ((token.match(/"/g) ?? []).length % 2) return invalid;
        maxAgeSeconds = Number(match[1]);
      } else if (/^includesubdomains$/i.test(token)) includeSubDomains = true;
      else if (/^preload$/i.test(token)) preload = true;
      else partial = true;
    }
    return maxAgeSeconds === null
      ? invalid
      : parsed({ maxAgeSeconds, includeSubDomains, preload }, partial);
  });
  const contentTypeOptions = single('x-content-type-options', (value) =>
    parsed(
      { nosniff: value.trim().toLowerCase() === 'nosniff' },
      value.trim().toLowerCase() !== 'nosniff',
    ),
  );
  const referrerPolicy = single<{ policy: SecurityReferrerPolicy | 'UNKNOWN' }>(
    'referrer-policy',
    (value) => {
      const tokens = value.split(',').map((v) => v.trim());
      const recognized = tokens.filter((v): v is SecurityReferrerPolicy =>
        referrers.includes(v as SecurityReferrerPolicy),
      );
      return parsed(
        { policy: recognized.at(-1) ?? 'UNKNOWN' },
        recognized.length !== tokens.length,
      );
    },
  );
  const permissionsPolicy = single('permissions-policy', permissions);
  const xFrameOptions = single<{
    policy: 'DENY' | 'SAMEORIGIN' | 'CONFLICTING' | 'UNKNOWN';
  }>('x-frame-options', (value) => {
    const tokens = value.split(',').map((v) => v.trim().toUpperCase());
    if (tokens.some((v) => v !== 'DENY' && v !== 'SAMEORIGIN'))
      return parsed({ policy: 'UNKNOWN' }, true);
    return parsed({
      policy:
        new Set(tokens).size > 1
          ? 'CONFLICTING'
          : (tokens[0] as 'DENY' | 'SAMEORIGIN'),
    });
  });
  const frameAncestors: PassiveSecurityAssessment['framing']['frameAncestors'] =
    enforced.presence === 'ABSENT'
      ? { state: 'OBSERVED', facts: { state: 'ABSENT' } }
      : enforced.presence === 'PRESENT' && 'facts' in enforced
        ? {
            state: 'OBSERVED',
            facts: enforced.facts.some((p) =>
              p.directives.some((d) => d.directive === 'frame-ancestors'),
            )
              ? {
                  state: 'PRESENT',
                  policyOrdinals: enforced.facts
                    .filter((p) =>
                      p.directives.some(
                        (d) => d.directive === 'frame-ancestors',
                      ),
                    )
                    .map((p) => p.ordinal),
                }
              : { state: 'ABSENT' },
          }
        : {
            state: 'UNKNOWN',
            reason: bounded ? 'UNSUPPORTED_SYNTAX' : 'HEADERS_UNAVAILABLE',
          };
  let cookies: PassiveSecurityAssessment['cookies'] = {
    state: 'UNAVAILABLE',
    reason: 'COOKIE_OBSERVATION_UNAVAILABLE',
  };
  const cookieValues = values('set-cookie');
  if (
    bounded &&
    cookieValues.length <= 100 &&
    cookieValues.every((v) => v.length <= MAX_VALUE && !/[\r\n\0]/.test(v))
  ) {
    const facts: CookieAttributeSecurityObservation[] = [];
    let valid = true;
    cookieValues.forEach((value, ordinal) => {
      const [pair, ...attributes] = value.split(';');
      if (!/^[^=\s;,]+=[^;]*$/.test(pair)) {
        valid = false;
        return;
      }
      const names = attributes.map((v) => v.trim().toLowerCase());
      const sameSites = names.filter((v) => /^samesite(?:\s*=|$)/.test(v));
      const sameSite =
        sameSites.length === 0
          ? 'ABSENT'
          : sameSites.length !== 1
            ? 'INVALID'
            : (/^samesite\s*=\s*(strict|lax|none)$/
                .exec(sameSites[0])?.[1]
                .toUpperCase() ?? 'INVALID');
      facts.push({
        ordinal,
        documentResponseOrdinal: responseOrdinal,
        scope: redirect
          ? 'MAIN_DOCUMENT_REDIRECT_RESPONSE'
          : 'MAIN_DOCUMENT_RESPONSE',
        secure: names.includes('secure'),
        httpOnly: names.includes('httponly'),
        sameSite: sameSite as CookieAttributeSecurityObservation['sameSite'],
        partitioned: names.includes('partitioned'),
      });
    });
    cookies = valid
      ? { state: 'OBSERVED', facts }
      : { state: 'UNKNOWN', reason: 'UNSUPPORTED_SYNTAX' };
  }
  const media = values('content-type')[0]
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();
  const mediaType:
    | 'text/html'
    | 'application/xhtml+xml'
    | 'application/json'
    | 'text/plain'
    | 'OTHER'
    | 'ABSENT'
    | 'INVALID' = !bounded
    ? 'INVALID'
    : media === undefined
      ? 'ABSENT'
      : [
            'text/html',
            'application/xhtml+xml',
            'application/json',
            'text/plain',
          ].includes(media)
        ? (media as 'text/html')
        : /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(media)
          ? 'OTHER'
          : 'INVALID';
  return {
    csp: { enforced, reportOnly },
    hsts,
    contentTypeOptions,
    referrerPolicy,
    permissionsPolicy,
    framing: { frameAncestors, xFrameOptions },
    cookies,
    mediaType,
  };
}

@Injectable()
export class SecurityObservationService {
  attach(page: Page, requestedUrl: string) {
    const sites = new Map<string, number>();
    const site = (url: string) => {
      const origin = projectSafeUrlOrigin(url);
      if (origin === '[INVALID_URL]') return null;
      if (!sites.has(origin)) sites.set(origin, sites.size);
      return { ordinal: sites.get(origin)! };
    };
    const requestedSite = site(requestedUrl);
    const requestedScheme = scheme(requestedUrl);
    const pending: Promise<void>[] = [];
    const hops: MainDocumentHop[] = [];
    const requests = new Map<ReturnType<Response['request']>, number>();
    const observations: ReturnType<typeof observeSecurityHeaders>[] = [];
    let limited = false;
    let stopped = false;
    let lastUrl: string | null = null;
    const listener = (response: Response) => {
      if (stopped) return;
      try {
        const request = response.request();
        if (
          request.resourceType() !== 'document' ||
          !request.isNavigationRequest() ||
          request.frame() !== page.mainFrame()
        )
          return;
        if (hops.length >= MAX_RESPONSES) {
          limited = true;
          return;
        }
        const ordinal = hops.length;
        const status = response.status();
        const previous = request.redirectedFrom();
        lastUrl = response.url();
        hops.push({
          ordinal,
          redirectedFromOrdinal: previous
            ? (requests.get(previous) ?? null)
            : null,
          scheme: scheme(lastUrl),
          status,
          site: site(lastUrl),
        });
        requests.set(request, ordinal);
        pending.push(
          (async () => {
            let headers: Headers | null;
            try {
              headers = await response.headersArray();
            } catch {
              headers = null;
            }
            observations[ordinal] = observeSecurityHeaders(
              headers,
              ordinal,
              status >= 300 && status < 400 && status !== 304,
            );
          })().catch(() => {
            observations[ordinal] = observeSecurityHeaders(
              null,
              ordinal,
              false,
            );
          }),
        );
      } catch {
        limited = true;
      }
    };
    page.on('response', listener);
    return {
      getObservation: async (
        finalUrl: string,
      ): Promise<PassiveSecurityObservation> => {
        stopped = true;
        page.off('response', listener);
        await Promise.all(pending);
        const final = hops.at(-1);
        const fields =
          lastUrl === finalUrl && !limited
            ? (observations.at(-1) ?? observeSecurityHeaders(null, 0, false))
            : observeSecurityHeaders(null, 0, false);
        const { mediaType, ...headers } = fields;
        const reasons = new Set<SecurityCoverageReason>([
          'NETWORK_OBSERVATION_UNAVAILABLE',
        ]);
        if (!final) reasons.add('MAIN_DOCUMENT_UNAVAILABLE');
        if (limited) reasons.add('OBSERVATION_LIMIT_REACHED');
        if (lastUrl !== finalUrl) reasons.add('NAVIGATION_CHANGED');
        if (fields.csp.enforced.presence === 'UNAVAILABLE')
          reasons.add('HEADERS_UNAVAILABLE');
        if (observations.some((o) => o.cookies.state !== 'OBSERVED'))
          reasons.add('COOKIE_OBSERVATION_UNAVAILABLE');
        for (const observation of observations) {
          for (const header of [
            observation.csp.enforced,
            observation.csp.reportOnly,
            observation.hsts,
            observation.contentTypeOptions,
            observation.referrerPolicy,
            observation.permissionsPolicy,
            observation.framing.xFrameOptions,
          ]) {
            if (header.presence === 'PRESENT' && header.parseState !== 'PARSED')
              reasons.add('UNSUPPORTED_SYNTAX');
            if (header.presence === 'UNAVAILABLE')
              reasons.add('HEADERS_UNAVAILABLE');
          }
        }
        const finalScheme = scheme(finalUrl);
        const schemes = [
          requestedScheme,
          ...hops.map((h) => h.scheme),
          finalScheme,
        ];
        const transportState =
          !final ||
          limited ||
          lastUrl !== finalUrl ||
          schemes.some((s) => s !== 'HTTP' && s !== 'HTTPS')
            ? 'UNCERTAIN'
            : schemes.some(
                  (s, i) => i > 0 && schemes[i - 1] === 'HTTPS' && s === 'HTTP',
                )
              ? 'HTTPS_TO_HTTP_OBSERVED'
              : requestedScheme === 'HTTP' && finalScheme === 'HTTPS'
                ? 'HTTP_TO_HTTPS_OBSERVED'
                : schemes.includes('HTTP')
                  ? 'HTTP_OBSERVED'
                  : 'HTTPS_ONLY_OBSERVED';
        return {
          mainDocumentResponses: hops,
          assessment: {
            coverage: {
              version: 1,
              rulesetVersion: 1,
              state: final ? 'PARTIAL' : 'UNAVAILABLE',
              reasons: [...reasons],
            },
            navigation: {
              state: 'OBSERVED',
              facts: {
                requestedScheme,
                finalScheme,
                requestedSite,
                finalSite: site(finalUrl),
                transportState,
              },
            },
            mainDocument:
              final && lastUrl === finalUrl
                ? {
                    state: 'OBSERVED',
                    facts: {
                      status: final.status,
                      mediaType,
                      site: final.site,
                    },
                  }
                : {
                    state: 'UNAVAILABLE',
                    reason: final
                      ? 'NAVIGATION_CHANGED'
                      : 'MAIN_DOCUMENT_UNAVAILABLE',
                  },
            ...headers,
            cookies:
              !final ||
              observations.some((o) => o.cookies.state !== 'OBSERVED') ||
              limited
                ? {
                    state: 'UNAVAILABLE',
                    reason: 'COOKIE_OBSERVATION_UNAVAILABLE',
                  }
                : {
                    state: 'OBSERVED',
                    facts: observations.flatMap((o) =>
                      o.cookies.state === 'OBSERVED' ? o.cookies.facts : [],
                    ),
                  },
            mixedContent: {
              state: 'UNAVAILABLE',
              reason: 'NETWORK_OBSERVATION_UNAVAILABLE',
            },
          },
        };
      },
    };
  }
}
