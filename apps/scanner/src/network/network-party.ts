import type { NetworkParty } from './network.types';

export function classifyNetworkParty(
  pageUrl: string,
  resourceUrl: string,
): NetworkParty {
  try {
    const page = new URL(pageUrl);

    const resource = new URL(resourceUrl);

    const pageHost = normalizeHostname(page.hostname);

    const resourceHost = normalizeHostname(resource.hostname);

    if (pageHost === resourceHost) {
      return 'FIRST_PARTY';
    }

    if (resourceHost.endsWith(`.${pageHost}`)) {
      return 'FIRST_PARTY';
    }

    if (pageHost.endsWith(`.${resourceHost}`)) {
      return 'FIRST_PARTY';
    }

    return 'THIRD_PARTY';
  } catch {
    return 'THIRD_PARTY';
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}
