import { Module } from '@nestjs/common';

import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';
import { AuthModule } from '../auth/auth.module';
import { OrganizationScansController } from './organization-scans.controller';

@Module({
  imports: [AuthModule],
  controllers: [ScansController, OrganizationScansController],
  providers: [ScansService],
})
export class ScansModule {}
