import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizationRole } from '@reactpulse/database';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationRoles } from '../organizations/decorators/organization-roles.decorator';
import { OrganizationAccessGuard } from '../organizations/guards/organization-access.guard';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import { UpdateEnvironmentDto } from './dto/update-environment.dto';
import { EnvironmentsService } from './environments.service';

@Controller('organizations/:organizationId/projects/:projectId/environments')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

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

    @Body()
    dto: CreateEnvironmentDto,
  ) {
    return this.environmentsService.create(organizationId, projectId, dto);
  }

  @Get()
  findAll(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,
  ) {
    return this.environmentsService.findAll(organizationId, projectId);
  }

  @Patch(':environmentId')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.DEVELOPER,
  )
  update(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @Param('environmentId')
    environmentId: string,

    @Body()
    dto: UpdateEnvironmentDto,
  ) {
    return this.environmentsService.update(
      organizationId,
      projectId,
      environmentId,
      dto,
    );
  }

  @Delete(':environmentId')
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @Param('environmentId')
    environmentId: string,
  ): Promise<void> {
    await this.environmentsService.remove(
      organizationId,
      projectId,
      environmentId,
    );
  }
}
