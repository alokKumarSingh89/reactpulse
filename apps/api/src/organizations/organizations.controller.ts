import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OrganizationAccessGuard } from './guards/organization-access.guard';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findForUser(user.userId);
  }

  @Get(':organizationId')
  @UseGuards(OrganizationAccessGuard)
  findOne(
    @Param('organizationId')
    organizationId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.organizationsService.findOne(organizationId, user.userId);
  }
}
