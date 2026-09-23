import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrismaClient, type DatabaseClient } from '@reactpulse/database';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly client: DatabaseClient;

  constructor(config: ConfigService) {
    this.client = createPrismaClient({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
