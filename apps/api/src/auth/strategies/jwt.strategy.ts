import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { SessionStatus, UserStatus } from '@reactpulse/database';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { DatabaseService } from '../../database/database.service';
import type { AccessTokenPayload, AuthenticatedUser } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly database: DatabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    console.log('[JWT] validate started', {
      sub: payload.sub,
      sid: payload.sid,
    });

    if (!payload.sub || !payload.sid) {
      console.log('[JWT] invalid payload');

      throw new UnauthorizedException();
    }

    console.log('[JWT] querying session');

    const startedAt = Date.now();

    const session = await this.database.client.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        status: SessionStatus.ACTIVE,

        expiresAt: {
          gt: new Date(),
        },

        user: {
          status: UserStatus.ACTIVE,
        },
      },

      select: {
        id: true,
        userId: true,
      },
    });

    console.log('[JWT] session query completed', {
      durationMs: Date.now() - startedAt,
      found: Boolean(session),
    });

    if (!session) {
      throw new UnauthorizedException('Session is no longer active');
    }

    console.log('[JWT] authentication successful');

    return {
      userId: session.userId,
      sessionId: session.id,
    };
  }
}
