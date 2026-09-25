import { getDomain } from 'tldts';

import type { NetworkParty } from './network.types';

export function classifyNetworkParty(
  pageUrl: string,
  resourceUrl: string,
): NetworkParty {
  try {
    const page = new URL(pageUrl);

    const resource = new URL(resourceUrl);

    const pageHostname = normalizeHostname(page.hostname);

    const resourceHostname = normalizeHostname(resource.hostname);

    /*
     * Exact hostname is always first-party.
     */
    if (pageHostname === resourceHostname) {
      return 'FIRST_PARTY';
    }

    /*
     * Private suffix support is important for hosting
     * platforms such as:
     *
     *   foo.github.io
     *   bar.github.io
     *
     * These are separate sites even though they share
     * the github.io suffix.
     */
    const options = {
      allowPrivateDomains: true,
    };

    const pageDomain = getDomain(pageHostname, options);

    const resourceDomain = getDomain(resourceHostname, options);

    /*
     * If tldts cannot determine a registrable domain,
     * fail closed instead of assuming first-party.
     */
    if (!pageDomain || !resourceDomain) {
      return 'THIRD_PARTY';
    }

    return pageDomain === resourceDomain ? 'FIRST_PARTY' : 'THIRD_PARTY';
  } catch {
    return 'THIRD_PARTY';
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}
