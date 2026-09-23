import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrganizationRole, SessionStatus } from '@reactpulse/database';
import * as argon2 from 'argon2';

import { DatabaseService } from '../database/database.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, metadata: RequestMetadata) {
    const email = dto.email.trim().toLowerCase();
    const organizationSlug = dto.organizationSlug.trim().toLowerCase();

    const existingUser = await this.database.client.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const existingOrganization =
      await this.database.client.organization.findUnique({
        where: {
          slug: organizationSlug,
        },
        select: {
          id: true,
        },
      });

    if (existingOrganization) {
      throw new ConflictException('Organization slug is already in use');
    }

    const passwordHash = await argon2.hash(dto.password);

    const result = await this.database.client.$transaction(
      async (transaction) => {
        const user = await transaction.user.create({
          data: {
            email,
            name: dto.name.trim(),

            credential: {
              create: {
                passwordHash,
              },
            },
          },
        });

        const organization = await transaction.organization.create({
          data: {
            name: dto.organizationName.trim(),
            slug: organizationSlug,

            members: {
              create: {
                userId: user.id,
                role: OrganizationRole.OWNER,
              },
            },
          },
        });

        return {
          user,
          organization,
        };
      },
    );

    const session = await this.createSession(result.user.id, metadata);

    const accessToken = await this.issueAccessToken(result.user.id, session.id);

    return {
      accessToken,

      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },

      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
    };
  }

  async login(dto: LoginDto, metadata: RequestMetadata) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.database.client.user.findUnique({
      where: {
        email,
      },

      include: {
        credential: true,
      },
    });

    if (!user?.credential) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const validPassword = await argon2.verify(
      user.credential.passwordHash,
      dto.password,
    );

    if (!validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const session = await this.createSession(user.id, metadata);

    const accessToken = await this.issueAccessToken(user.id, session.id);

    return {
      accessToken,

      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.database.client.session.updateMany({
      where: {
        id: sessionId,
        userId,
        status: SessionStatus.ACTIVE,
      },

      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
  }

  private async createSession(userId: string, metadata: RequestMetadata) {
    const sessionTtlDays = this.configService.get<number>(
      'SESSION_TTL_DAYS',
      30,
    );

    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + sessionTtlDays);

    return this.database.client.session.create({
      data: {
        userId,
        expiresAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });
  }

  private async issueAccessToken(
    userId: string,
    sessionId: string,
  ): Promise<string> {
    return this.jwtService.signAsync({
      sub: userId,
      sid: sessionId,
    });
  }
}
