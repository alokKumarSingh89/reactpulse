import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly database: DatabaseService) {}

  async create(organizationId: string, dto: CreateProjectDto) {
    const slug = dto.slug.trim().toLowerCase();

    const existing = await this.database.client.project.findUnique({
      where: {
        organizationId_slug: {
          organizationId,
          slug,
        },
      },

      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('A project with this slug already exists');
    }

    return this.database.client.project.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        slug,
      },

      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  findAll(organizationId: string): any {
    return this.database.client.project.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,

        _count: {
          select: {
            environments: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(organizationId: string, projectId: string) {
    const project = await this.database.client.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },

      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,

        environments: {
          select: {
            id: true,
            name: true,
            url: true,
            type: true,
            createdAt: true,
          },

          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(
    organizationId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    await this.assertProjectExists(organizationId, projectId);

    return this.database.client.project.update({
      where: {
        id: projectId,
      },

      data: {
        ...(dto.name !== undefined && {
          name: dto.name.trim(),
        }),

        ...(dto.status !== undefined && {
          status: dto.status,
        }),
      },

      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async remove(organizationId: string, projectId: string): Promise<void> {
    await this.assertProjectExists(organizationId, projectId);

    await this.database.client.project.delete({
      where: {
        id: projectId,
      },
    });
  }

  async assertProjectExists(
    organizationId: string,
    projectId: string,
  ): Promise<void> {
    const project = await this.database.client.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },

      select: {
        id: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }
}
