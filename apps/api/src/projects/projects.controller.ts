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
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('organizations/:organizationId/projects')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.DEVELOPER,
  )
  create(
    @Param('organizationId')
    organizationId: string,

    @Body()
    dto: CreateProjectDto,
  ) {
    return this.projectsService.create(organizationId, dto);
  }

  @Get()
  findAll(
    @Param('organizationId')
    organizationId: string,
  ) {
    return this.projectsService.findAll(organizationId);
  }

  @Get(':projectId')
  findOne(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,
  ) {
    return this.projectsService.findOne(organizationId, projectId);
  }

  @Patch(':projectId')
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

    @Body()
    dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(organizationId, projectId, dto);
  }

  @Delete(':projectId')
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,
  ): Promise<void> {
    await this.projectsService.remove(organizationId, projectId);
  }
}
