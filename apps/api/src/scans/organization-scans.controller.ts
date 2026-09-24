import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { OrganizationAccessGuard } from '../organizations/guards/organization-access.guard';

import { ScansService } from './scans.service';

@Controller('organizations/:organizationId/scans')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class OrganizationScansController {
  constructor(private readonly scansService: ScansService) {}

  @Get()
  findAll(
    @Param('organizationId')
    organizationId: string,
  ) {
    return this.scansService.findAllForOrganization(organizationId);
  }

  @Get(':scanId')
  findOne(
    @Param('organizationId')
    organizationId: string,

    @Param('scanId')
    scanId: string,
  ) {
    return this.scansService.findOneForOrganization(organizationId, scanId);
  }
}
