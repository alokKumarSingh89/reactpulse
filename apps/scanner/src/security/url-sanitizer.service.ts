import { Injectable } from '@nestjs/common';

@Injectable()
export class UrlSanitizerService {
  private readonly sensitiveParameters = new Set([
    'access_token',
    'token',
    'auth',
    'authorization',
    'password',
    'passwd',
    'secret',
    'api_key',
    'apikey',
    'api-key',
    'session',
    'session_id',
    'sessionid',
    'code',
  ]);

  sanitize(rawUrl: string): string {
    try {
      const url = new URL(rawUrl);

      for (const key of Array.from(url.searchParams.keys())) {
        if (this.isSensitiveKey(key)) {
          url.searchParams.set(key, '[REDACTED]');
        }
      }

      url.hash = '';

      return url.toString();
    } catch {
      return '[INVALID_URL]';
    }
  }

  hostname(rawUrl: string): string {
    try {
      return new URL(rawUrl).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  private isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase();

    if (this.sensitiveParameters.has(normalized)) {
      return true;
    }

    return (
      normalized.includes('token') ||
      normalized.includes('secret') ||
      normalized.includes('password')
    );
  }
}
