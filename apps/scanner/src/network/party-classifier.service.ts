import { Injectable } from '@nestjs/common';

@Injectable()
export class PartyClassifierService {
  isFirstParty(targetUrl: string, resourceUrl: string): boolean {
    try {
      const target = new URL(targetUrl);

      const resource = new URL(resourceUrl);

      return target.hostname === resource.hostname;
    } catch {
      return false;
    }
  }
}
