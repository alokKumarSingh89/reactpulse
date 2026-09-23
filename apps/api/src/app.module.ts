import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';

import { appConfig } from './config/app.config';
import { envValidationSchema } from './config/env.validation';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ProjectsModule } from './projects/projects.module';
import { EnvironmentsModule } from './environments/environments.module';
import { UrlPolicyModule } from './security/url/url-policy.module';
import { QueueModule } from './queue/queue.module';
import { ScansModule } from './scans/scans.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
      validationSchema: envValidationSchema,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  translateTime: 'SYS:standard',
                },
              }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    EnvironmentsModule,
    UrlPolicyModule,
    QueueModule,
    ScansModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
