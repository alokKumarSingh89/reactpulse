const SENSITIVE_QUERY_KEYS = new Set([
  'access_token',
  'accesstoken',

  'api_key',
  'apikey',

  'authorization',

  'auth',

  'code',

  'credential',

  'email',

  'jwt',

  'key',

  'password',

  'refresh_token',
  'refreshtoken',

  'secret',

  'session',
  'session_id',
  'sessionid',

  'sig',
  'signature',

  'token',
]);

export function sanitizeNetworkUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);

    url.hash = '';

    for (const key of Array.from(url.searchParams.keys())) {
      const normalizedKey = key.trim().toLowerCase();

      if (SENSITIVE_QUERY_KEYS.has(normalizedKey)) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }

    return url.toString();
  } catch {
    return '[INVALID_URL]';
  }
}
