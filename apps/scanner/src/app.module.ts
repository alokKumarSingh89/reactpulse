import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { LoggerModule } from 'nestjs-pino';

import { BrowserScannerService } from './browser/browser-scanner.service';

import { envValidationSchema } from './config/env.validation';

import { DatabaseModule } from './database/database.module';

import { PerformanceCollectorService } from './performance/performance-collector.service';

import { PerformanceMetricService } from './performance/performance-metric.service';

import { RedisService } from './queue/redis.service';

import { ScanEvidenceService } from './scans/scan-evidence.service';

import { ScanProcessor } from './scans/scan.processor';

import { TargetValidatorService } from './security/target-validator.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

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
      },
    }),

    DatabaseModule,
  ],

  providers: [
    RedisService,

    TargetValidatorService,

    PerformanceCollectorService,

    PerformanceMetricService,

    BrowserScannerService,

    ScanEvidenceService,

    ScanProcessor,
  ],
})
export class AppModule {}
