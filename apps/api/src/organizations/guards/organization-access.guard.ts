import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrganizationRole } from '@reactpulse/database';

import type { AuthenticatedUser } from '../../auth/auth.types';
import { DatabaseService } from '../../database/database.service';
import { ORGANIZATION_ROLES_KEY } from '../decorators/organization-roles.decorator';

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    private readonly database: DatabaseService,
    private readonly reflector: Reflector,
  ) {
    console.log('[ORG GUARD] constructed');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    console.log('[ORG GUARD] started');

    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      params: {
        organizationId?: string;
      };
    }>();

    const organizationId = request.params.organizationId;

    console.log('[ORG GUARD] context', {
      organizationId,
      userId: request.user?.userId,
    });

    if (!organizationId) {
      throw new ForbiddenException('Organization context is required');
    }

    console.log('[ORG GUARD] querying membership');

    const startedAt = Date.now();

    const membership = await this.database.client.organizationMember.findUnique(
      {
        where: {
          organizationId_userId: {
            organizationId,
            userId: request.user.userId,
          },
        },

        select: {
          role: true,
        },
      },
    );

    console.log('[ORG GUARD] membership query completed', {
      durationMs: Date.now() - startedAt,
      membership,
    });

    if (!membership) {
      console.log('[ORG GUARD] membership missing -> 403');

      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    console.log('[ORG GUARD] required roles', {
      requiredRoles,
      actualRole: membership.role,
    });

    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient organization permissions');
    }

    console.log('[ORG GUARD] access granted');

    return true;
  }
}
