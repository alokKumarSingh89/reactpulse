/**
 * Passive, derived observations only. No raw headers, URLs, cookie identifiers,
 * values, or arbitrary evidence payloads belong in this contract.
 *
 * TypeScript is not a runtime sanitization boundary. Producers must eventually
 * project allowlisted fields and validate finite numbers, HTTP status ranges,
 * nonnegative integer references, collection limits and cross-field consistency.
 * Unknown/unsupported input must never be copied into a free-form fallback.
 */
export const PASSIVE_SECURITY_CONTRACT_VERSION = 1 as const;

export type SecurityCoverageReason =
  | "MAIN_DOCUMENT_UNAVAILABLE"
  | "HEADERS_UNAVAILABLE"
  | "COOKIE_OBSERVATION_UNAVAILABLE"
  | "NETWORK_OBSERVATION_UNAVAILABLE"
  | "INITIATOR_UNKNOWN"
  | "NAVIGATION_CHANGED"
  | "UNSUPPORTED_SYNTAX"
  | "OBSERVATION_LIMIT_REACHED"
  | "COLLECTION_FAILED";

export interface SecurityAssessmentCoverage {
  version: typeof PASSIVE_SECURITY_CONTRACT_VERSION;
  /** Positive integer identifying the interpreting ruleset; not a rule result. */
  rulesetVersion: number;
  state: "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
  reasons: readonly SecurityCoverageReason[];
}

/** Unavailable is distinct from an observed absence. */
export type SecurityObservation<T> =
  | { state: "OBSERVED"; facts: T }
  | { state: "UNKNOWN" | "UNAVAILABLE"; reason: SecurityCoverageReason };

export type SecurityHeaderObservation<T> =
  | { presence: "ABSENT" }
  | { presence: "UNAVAILABLE"; reason: SecurityCoverageReason }
  | {
      presence: "PRESENT";
      parseState: "PARSED" | "PARTIAL";
      facts: T;
    }
  | { presence: "PRESENT"; parseState: "INVALID" | "UNSUPPORTED" };

/** Scanner-assigned scan-local identity, never a hostname, URL or secret hash. */
export interface SecuritySiteReference {
  ordinal: number;
}

/** Refers to the existing network request sequence, not a duplicate collector. */
export interface SecurityResourceReference {
  requestSequence: number;
}

export type SecurityScheme = "HTTP" | "HTTPS" | "OTHER" | "UNKNOWN";

export interface NavigationSecurityFacts {
  requestedScheme: SecurityScheme;
  finalScheme: SecurityScheme;
  requestedSite: SecuritySiteReference | null;
  finalSite: SecuritySiteReference | null;
  /** Describes observed transport only; does not assert TLS strength or safety. */
  transportState:
    | "HTTPS_ONLY_OBSERVED"
    | "HTTP_OBSERVED"
    | "HTTP_TO_HTTPS_OBSERVED"
    | "HTTPS_TO_HTTP_OBSERVED"
    | "UNCERTAIN";
}

export type SecurityMediaType =
  | "text/html"
  | "application/xhtml+xml"
  | "application/json"
  | "text/plain"
  | "OTHER"
  | "ABSENT"
  | "INVALID";

export interface MainDocumentSecurityFacts {
  status: number;
  mediaType: SecurityMediaType;
  site: SecuritySiteReference | null;
}

export type SecurityCspDirective =
  | "default-src"
  | "script-src"
  | "script-src-elem"
  | "script-src-attr"
  | "style-src"
  | "object-src"
  | "base-uri"
  | "form-action"
  | "frame-ancestors"
  | "upgrade-insecure-requests"
  | "block-all-mixed-content";

/** Categories retain no host sources, nonce/hash material or reporting URLs. */
export type SecurityCspSourceKind =
  | "NONE"
  | "SELF"
  | "WILDCARD"
  | "HTTPS_SCHEME"
  | "HTTP_SCHEME"
  | "DATA_SCHEME"
  | "BLOB_SCHEME"
  | "UNSAFE_INLINE"
  | "UNSAFE_EVAL"
  | "STRICT_DYNAMIC"
  | "NONCE_PRESENT"
  | "HASH_PRESENT"
  | "EXPLICIT_SOURCE_PRESENT"
  | "UNRECOGNIZED";

export interface SecurityCspPolicyFacts {
  /** Preserve multiple policies separately; never union their permissions. */
  ordinal: number;
  directives: readonly {
    directive: SecurityCspDirective;
    sources: readonly SecurityCspSourceKind[];
  }[];
  hasUnrecognizedDirectives: boolean;
}

export interface CspSecurityObservation {
  enforced: SecurityHeaderObservation<readonly SecurityCspPolicyFacts[]>;
  reportOnly: SecurityHeaderObservation<readonly SecurityCspPolicyFacts[]>;
}

export interface HstsSecurityFacts {
  /** Finite, nonnegative integer; zero remains a meaningful observation. */
  maxAgeSeconds: number | null;
  includeSubDomains: boolean;
  /** Header token only, not verification of preload-list membership. */
  preload: boolean;
}

export type SecurityReferrerPolicy =
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "origin"
  | "origin-when-cross-origin"
  | "same-origin"
  | "strict-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url";

export type SecurityPermissionFeature =
  | "camera"
  | "microphone"
  | "geolocation"
  | "payment"
  | "usb"
  | "fullscreen"
  | "display-capture"
  | "clipboard-read"
  | "clipboard-write";

export interface PermissionsPolicySecurityFacts {
  features: readonly {
    feature: SecurityPermissionFeature;
    allowlist:
      | "NONE"
      | "SELF"
      | "ALL"
      | "EXPLICIT_SITES"
      | "SELF_AND_EXPLICIT_SITES"
      | "UNKNOWN";
  }[];
  hasUnrecognizedFeatures: boolean;
}

export interface FramingSecurityObservation {
  /** Enforced CSP only. Default-src is not a frame-ancestors fallback. */
  frameAncestors: SecurityObservation<
    | { state: "ABSENT" }
    | { state: "PRESENT"; policyOrdinals: readonly number[] }
  >;
  xFrameOptions: SecurityHeaderObservation<{
    policy: "DENY" | "SAMEORIGIN" | "CONFLICTING" | "UNKNOWN";
  }>;
}

export type CookieSecurityScope =
  "MAIN_DOCUMENT_RESPONSE" | "MAIN_DOCUMENT_REDIRECT_RESPONSE";

export interface CookieAttributeSecurityObservation {
  /** Response-local cookie ordinal; never derived from the cookie value/name. */
  ordinal: number;
  documentResponseOrdinal: number;
  scope: CookieSecurityScope;
  secure: boolean;
  httpOnly: boolean;
  /** Explicit response attribute, not inferred browser defaults. */
  sameSite: "STRICT" | "LAX" | "NONE" | "ABSENT" | "INVALID";
  partitioned: boolean;
}

export type SecurityResourceType =
  | "document"
  | "stylesheet"
  | "image"
  | "media"
  | "font"
  | "script"
  | "texttrack"
  | "xhr"
  | "fetch"
  | "eventsource"
  | "websocket"
  | "manifest"
  | "other";

export interface MixedContentSecurityObservation {
  resource: SecurityResourceReference;
  resourceType: SecurityResourceType;
  initiatorScheme: SecurityScheme;
  requestedScheme: SecurityScheme;
  /** FAILED does not assert that mixed-content enforcement caused failure. */
  outcome: "ATTEMPTED" | "RESPONSE_OBSERVED" | "FAILED" | "UNCERTAIN";
}

/** Shareable observation result, not a Finding or a security verdict. */
export interface PassiveSecurityAssessment {
  coverage: SecurityAssessmentCoverage;
  navigation: SecurityObservation<NavigationSecurityFacts>;
  mainDocument: SecurityObservation<MainDocumentSecurityFacts>;
  csp: CspSecurityObservation;
  hsts: SecurityHeaderObservation<HstsSecurityFacts>;
  contentTypeOptions: SecurityHeaderObservation<{ nosniff: boolean }>;
  referrerPolicy: SecurityHeaderObservation<{
    policy: SecurityReferrerPolicy | "UNKNOWN";
  }>;
  permissionsPolicy: SecurityHeaderObservation<PermissionsPolicySecurityFacts>;
  framing: FramingSecurityObservation;
  /** OBSERVED with an empty array means no cookies observed in this scope. */
  cookies: SecurityObservation<readonly CookieAttributeSecurityObservation[]>;
  mixedContent: SecurityObservation<readonly MixedContentSecurityObservation[]>;
}
