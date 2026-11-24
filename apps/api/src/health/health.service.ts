import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type Chequeo = 'ok' | 'error';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  vivo(): { estado: 'ok' } {
    return { estado: 'ok' };
  }

  async listo(): Promise<{ estado: 'ok' | 'no_disponible'; chequeos: { baseDatos: Chequeo } }> {
    if (!process.env.DATABASE_URL) {
      return { estado: 'no_disponible', chequeos: { baseDatos: 'error' } };
    }
    try {
      await this.prisma.ping();
      return { estado: 'ok', chequeos: { baseDatos: 'ok' } };
    } catch {
      return { estado: 'no_disponible', chequeos: { baseDatos: 'error' } };
    }
  }
}
