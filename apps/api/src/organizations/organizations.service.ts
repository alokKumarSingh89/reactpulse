import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly database: DatabaseService) {}

  async findForUser(userId: string) {
    const memberships = await this.database.client.organizationMember.findMany({
      where: {
        userId,
      },

      include: {
        organization: true,
      },

      orderBy: {
        createdAt: 'asc',
      },
    });

    return memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
    }));
  }

  async findOne(organizationId: string, userId: string) {
    const membership =
      await this.database.client.organizationMember.findUniqueOrThrow({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },

        include: {
          organization: true,
        },
      });

    return {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
      createdAt: membership.organization.createdAt,
    };
  }
}
