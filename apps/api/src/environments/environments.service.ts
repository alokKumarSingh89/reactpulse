import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { ProjectsService } from '../projects/projects.service';
import { UrlPolicyService } from '../security/url/url-policy.service';
import type { CreateEnvironmentDto } from './dto/create-environment.dto';
import type { UpdateEnvironmentDto } from './dto/update-environment.dto';

@Injectable()
export class EnvironmentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projectsService: ProjectsService,
    private readonly urlPolicy: UrlPolicyService,
  ) {}

  async create(
    organizationId: string,
    projectId: string,
    dto: CreateEnvironmentDto,
  ) {
    await this.projectsService.assertProjectExists(organizationId, projectId);

    const name = dto.name.trim();

    const existing = await this.database.client.environment.findUnique({
      where: {
        projectId_name: {
          projectId,
          name,
        },
      },

      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        'An environment with this name already exists',
      );
    }

    const normalizedUrl = this.urlPolicy.validateUserSuppliedUrl(dto.url);

    return this.database.client.environment.create({
      data: {
        projectId,
        name,
        url: normalizedUrl,
        type: dto.type,
      },

      select: {
        id: true,
        name: true,
        url: true,
        type: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll(organizationId: string, projectId: string) {
    await this.projectsService.assertProjectExists(organizationId, projectId);

    return this.database.client.environment.findMany({
      where: {
        projectId,
      },

      select: {
        id: true,
        name: true,
        url: true,
        type: true,
        createdAt: true,
        updatedAt: true,

        _count: {
          select: {
            scans: true,
          },
        },
      },

      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async update(
    organizationId: string,
    projectId: string,
    environmentId: string,
    dto: UpdateEnvironmentDto,
  ) {
    await this.assertEnvironmentExists(
      organizationId,
      projectId,
      environmentId,
    );

    const normalizedUrl =
      dto.url !== undefined
        ? this.urlPolicy.validateUserSuppliedUrl(dto.url)
        : undefined;

    return this.database.client.environment.update({
      where: {
        id: environmentId,
      },

      data: {
        ...(dto.name !== undefined && {
          name: dto.name.trim(),
        }),

        ...(normalizedUrl !== undefined && {
          url: normalizedUrl,
        }),

        ...(dto.type !== undefined && {
          type: dto.type,
        }),
      },

      select: {
        id: true,
        name: true,
        url: true,
        type: true,
        updatedAt: true,
      },
    });
  }

  async remove(
    organizationId: string,
    projectId: string,
    environmentId: string,
  ): Promise<void> {
    await this.assertEnvironmentExists(
      organizationId,
      projectId,
      environmentId,
    );

    await this.database.client.environment.delete({
      where: {
        id: environmentId,
      },
    });
  }

  private async assertEnvironmentExists(
    organizationId: string,
    projectId: string,
    environmentId: string,
  ): Promise<void> {
    await this.projectsService.assertProjectExists(organizationId, projectId);

    const environment = await this.database.client.environment.findFirst({
      where: {
        id: environmentId,
        projectId,
      },

      select: {
        id: true,
      },
    });

    if (!environment) {
      throw new NotFoundException('Environment not found');
    }
  }
}
