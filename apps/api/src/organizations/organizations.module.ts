import { Module } from '@nestjs/common';

import { OrganizationAccessGuard } from './guards/organization-access.guard';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController],

  providers: [OrganizationsService, OrganizationAccessGuard],

  exports: [OrganizationsService, OrganizationAccessGuard],
})
export class OrganizationsModule {}
