import { Global, Module } from '@nestjs/common';

import { UrlPolicyService } from './url-policy.service';

@Global()
@Module({
  providers: [UrlPolicyService],
  exports: [UrlPolicyService],
})
export class UrlPolicyModule {}
