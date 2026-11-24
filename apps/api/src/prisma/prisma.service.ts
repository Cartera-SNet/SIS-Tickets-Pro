import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { redactarSecretos } from '../adapters/redactar-url';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL no está definida. La API arranca sin base de datos.');
      return;
    }
    try {
      await this.$connect();
    } catch (error) {
      const detalle = error instanceof Error ? redactarSecretos(error.message) : 'sin conexión';
      this.logger.warn(`No se pudo conectar a PostgreSQL. ${detalle}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
