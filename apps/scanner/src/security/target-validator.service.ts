import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { resolve4, resolve6 } from 'node:dns/promises';

import { ScanExecutionError, ScanFailureCode } from '../scans/scan-failure';

@Injectable()
export class TargetValidatorService {
  async validate(rawUrl: string): Promise<URL> {
    let url: URL;

    try {
      url = new URL(rawUrl);
    } catch {
      throw new ScanExecutionError(
        ScanFailureCode.TARGET_NOT_ALLOWED,
        'Target URL is invalid',
      );
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new ScanExecutionError(
        ScanFailureCode.TARGET_NOT_ALLOWED,
        'Target protocol is not allowed',
      );
    }

    if (url.username || url.password) {
      throw new ScanExecutionError(
        ScanFailureCode.TARGET_NOT_ALLOWED,
        'Target URL credentials are not allowed',
      );
    }

    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');

    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local')
    ) {
      throw new ScanExecutionError(
        ScanFailureCode.TARGET_NOT_ALLOWED,
        'Local targets are not allowed',
      );
    }

    if (isIP(hostname)) {
      this.assertPublicIp(hostname);

      return url;
    }

    await this.validateDns(hostname);

    return url;
  }

  private async validateDns(hostname: string): Promise<void> {
    let ipv4: string[] = [];
    let ipv6: string[] = [];

    try {
      ipv4 = await resolve4(hostname);
    } catch {
      // Host may be IPv6-only.
    }

    try {
      ipv6 = await resolve6(hostname);
    } catch {
      // Host may be IPv4-only.
    }

    const addresses = [...ipv4, ...ipv6];

    if (addresses.length === 0) {
      throw new ScanExecutionError(
        ScanFailureCode.DNS_RESOLUTION_FAILED,
        'Target hostname could not be resolved',
      );
    }

    for (const address of addresses) {
      this.assertPublicIp(address);
    }
  }

  private assertPublicIp(address: string): void {
    if (this.isBlockedIpv4(address) || this.isBlockedIpv6(address)) {
      throw new ScanExecutionError(
        ScanFailureCode.TARGET_NOT_ALLOWED,
        'Target resolves to a private or reserved address',
      );
    }
  }

  private isBlockedIpv4(ip: string): boolean {
    if (isIP(ip) !== 4) {
      return false;
    }

    const [a, b] = ip.split('.').map(Number);

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

    const value = ip.toLowerCase();

    return (
      value === '::' ||
      value === '::1' ||
      value.startsWith('fc') ||
      value.startsWith('fd') ||
      value.startsWith('fe8') ||
      value.startsWith('fe9') ||
      value.startsWith('fea') ||
      value.startsWith('feb') ||
      value.startsWith('::ffff:127.') ||
      value.startsWith('::ffff:10.') ||
      value.startsWith('::ffff:192.168.')
    );
  }
}
