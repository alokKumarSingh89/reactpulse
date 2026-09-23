import { BadRequestException, Injectable } from '@nestjs/common';
import { isIP } from 'node:net';

@Injectable()
export class UrlPolicyService {
  validateUserSuppliedUrl(value: string): string {
    let url: URL;

    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('A valid absolute URL is required');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException('Only HTTP and HTTPS URLs are supported');
    }

    if (url.username || url.password) {
      throw new BadRequestException(
        'URLs containing credentials are not allowed',
      );
    }

    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');

    if (!hostname) {
      throw new BadRequestException('URL hostname is required');
    }

    if (hostname === 'localhost') {
      throw new BadRequestException('Local addresses are not allowed');
    }

    if (hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
      throw new BadRequestException('Local addresses are not allowed');
    }

    if (isIP(hostname)) {
      this.assertPublicIp(hostname);
    }

    url.hash = '';

    return url.toString();
  }

  private assertPublicIp(ip: string): void {
    if (this.isBlockedIpv4(ip)) {
      throw new BadRequestException(
        'Private or reserved IP addresses are not allowed',
      );
    }

    if (this.isBlockedIpv6(ip)) {
      throw new BadRequestException(
        'Private or reserved IP addresses are not allowed',
      );
    }
  }

  private isBlockedIpv4(ip: string): boolean {
    if (isIP(ip) !== 4) {
      return false;
    }

    const octets = ip.split('.').map((value) => Number(value));

    const [a, b] = octets;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }

  private isBlockedIpv6(ip: string): boolean {
    if (isIP(ip) !== 6) {
      return false;
    }

    const normalized = ip.toLowerCase();

    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    );
  }
}
