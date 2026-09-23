import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { DatabaseModule } from './database/database.module';
import { RedisService } from './queue/redis.service';
import { ScanProcessor } from './scans/scan.processor';
import { envValidationSchema } from './config/env.validation';
import { TargetValidatorService } from './security/target-validator.service';
import { BrowserScannerService } from './browser/browser-scanner.service';
import { ScanEvidenceService } from './scans/scan-evidence.service';

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
    BrowserScannerService,
    ScanProcessor,
    ScanEvidenceService,
  ],
})
export class AppModule {}
