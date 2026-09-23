import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  app.enableShutdownHooks();

  const logger = app.get(Logger);

  logger.log('ReactPulse scanner worker started', 'Bootstrap');
}

void bootstrap();
