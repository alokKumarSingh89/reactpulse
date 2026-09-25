import type {
  NetworkFailureEvidence,
  NetworkRequestEvidence,
  NetworkResponseEvidence,
  RawNetworkEvidence,
} from "./network.types";

export interface NormalizedNetworkEvidence {
  requests: NetworkRequestEvidence[];

  responses: NetworkResponseEvidence[];

  failures: NetworkFailureEvidence[];
}

export function normalizeNetworkEvidence(
  evidence: RawNetworkEvidence[],
): NormalizedNetworkEvidence {
  const requests: NetworkRequestEvidence[] = [];

  const responses: NetworkResponseEvidence[] = [];

  const failures: NetworkFailureEvidence[] = [];

  for (const item of evidence) {
    switch (item.type) {
      case "NETWORK_REQUEST": {
        const request = parseRequest(item.data);

        if (request) {
          requests.push(request);
        }

        break;
      }

      case "NETWORK_RESPONSE": {
        const response = parseResponse(item.data);

        if (response) {
          responses.push(response);
        }

        break;
      }

      case "NETWORK_FAILURE": {
        const failure = parseFailure(item.data);

        if (failure) {
          failures.push(failure);
        }

        break;
      }
    }
  }

  return {
    requests: requests.sort(bySequence),

    responses: responses.sort(bySequence),

    failures: failures.sort(bySequence),
  };
}

function parseRequest(value: unknown): NetworkRequestEvidence | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isNumber(value.sequence) ||
    !isString(value.url) ||
    !isString(value.method) ||
    !isString(value.resourceType) ||
    !isNullableString(value.domain) ||
    !isNetworkParty(value.party) ||
    !isNumber(value.startedAtMs)
  ) {
    return null;
  }

  return {
    sequence: value.sequence,

    url: value.url,

    method: value.method,

    resourceType: value.resourceType,

    domain: value.domain,

    party: value.party,

    startedAtMs: value.startedAtMs,
  };
}

function parseResponse(value: unknown): NetworkResponseEvidence | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isNumber(value.sequence) ||
    !isNumber(value.requestSequence) ||
    !isString(value.url) ||
    !isNumber(value.status) ||
    !isString(value.statusText) ||
    !isNullableString(value.domain) ||
    !isNetworkParty(value.party) ||
    !isString(value.resourceType) ||
    !isNullableNumber(value.durationMs) ||
    !isNullableNumber(value.transferSize) ||
    !isNullableNumber(value.encodedBodySize) ||
    !isNullableNumber(value.decodedBodySize) ||
    !isBoolean(value.fromServiceWorker) ||
    !isNullableString(value.cacheControl) ||
    !isNullableString(value.contentType)
  ) {
    return null;
  }

  return {
    sequence: value.sequence,

    requestSequence: value.requestSequence,

    url: value.url,

    status: value.status,

    statusText: value.statusText,

    domain: value.domain,

    party: value.party,

    resourceType: value.resourceType,

    durationMs: value.durationMs,

    transferSize: value.transferSize,

    encodedBodySize: value.encodedBodySize,

    decodedBodySize: value.decodedBodySize,

    fromServiceWorker: value.fromServiceWorker,

    cacheControl: value.cacheControl,

    contentType: value.contentType,
  };
}

function parseFailure(value: unknown): NetworkFailureEvidence | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isNumber(value.sequence) ||
    !isNumber(value.requestSequence) ||
    !isString(value.url) ||
    !isString(value.method) ||
    !isString(value.resourceType) ||
    !isNullableString(value.domain) ||
    !isNetworkParty(value.party) ||
    !isNullableString(value.failureText)
  ) {
    return null;
  }

  return {
    sequence: value.sequence,

    requestSequence: value.requestSequence,

    url: value.url,

    method: value.method,

    resourceType: value.resourceType,

    domain: value.domain,

    party: value.party,

    failureText: value.failureText,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isNetworkParty(
  value: unknown,
): value is "FIRST_PARTY" | "THIRD_PARTY" {
  return value === "FIRST_PARTY" || value === "THIRD_PARTY";
}

function bySequence<
  T extends {
    sequence: number;
  },
>(left: T, right: T): number {
  return left.sequence - right.sequence;
}
