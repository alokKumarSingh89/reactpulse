import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OrganizationRole } from '@reactpulse/database';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationRoles } from '../organizations/decorators/organization-roles.decorator';
import { OrganizationAccessGuard } from '../organizations/guards/organization-access.guard';
import { ScansService } from './scans.service';

@Controller(
  'organizations/:organizationId/projects/:projectId/environments/:environmentId/scans',
)
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post()
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.DEVELOPER,
  )
  create(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @Param('environmentId')
    environmentId: string,
  ) {
    return this.scansService.create(organizationId, projectId, environmentId);
  }

  @Get()
  findAll(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @Param('environmentId')
    environmentId: string,
  ) {
    return this.scansService.findAll(organizationId, projectId, environmentId);
  }

  @Get(':scanId')
  findOne(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @Param('environmentId')
    environmentId: string,

    @Param('scanId')
    scanId: string,
  ) {
    return this.scansService.findOne(
      organizationId,
      projectId,
      environmentId,
      scanId,
    );
  }
}
