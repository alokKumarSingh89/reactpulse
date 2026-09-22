import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

export interface CreatePrismaClientOptions {
  connectionString: string;
}

export function createPrismaClient({
  connectionString,
}: CreatePrismaClientOptions): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
  });

  return new PrismaClient({
    adapter,
  });
}

export type DatabaseClient = ReturnType<typeof createPrismaClient>;
