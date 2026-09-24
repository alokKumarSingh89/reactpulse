import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { LoggerModule } from 'nestjs-pino';

import * as Joi from 'joi';

import { BrowserScannerService } from './browser/browser-scanner.service';

import { DatabaseModule } from './database/database.module';

import { ScanEvidenceService } from './evidence/scan-evidence.service';

import { NetworkCollectorService } from './network/network-collector.service';

import { NetworkMetricService } from './network/network-metric.service';

import { PerformanceCollectorService } from './performance/performance-collector.service';

import { PerformanceMetricService } from './performance/performance-metric.service';

import { RedisService } from './queue/redis.service';

import { ScanProcessor } from './scans/scan.processor';

import { TargetValidatorService } from './security/target-validator.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),

        LOG_LEVEL: Joi.string().default('info'),

        DATABASE_URL: Joi.string().uri().required(),

        REDIS_HOST: Joi.string().required(),

        REDIS_PORT: Joi.number().port().default(6379),

        SCANNER_NAVIGATION_TIMEOUT_MS: Joi.number()
          .integer()
          .positive()
          .default(30000),

        SCANNER_MAX_REQUESTS: Joi.number().integer().positive().default(500),

        SCANNER_MAX_CONSOLE_MESSAGES: Joi.number()
          .integer()
          .positive()
          .default(100),
      }),
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',

        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],

          censor: '[REDACTED]',
        },

        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',

                options: {
                  singleLine: true,

                  translateTime: 'SYS:standard',
                },
              },
      },
    }),

    DatabaseModule,
  ],

  providers: [
    RedisService,

    TargetValidatorService,

    PerformanceCollectorService,
    PerformanceMetricService,

    NetworkCollectorService,
    NetworkMetricService,

    BrowserScannerService,

    ScanEvidenceService,

    ScanProcessor,
  ],
})
export class AppModule {}
