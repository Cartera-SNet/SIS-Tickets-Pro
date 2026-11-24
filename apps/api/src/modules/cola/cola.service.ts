import { HttpException, HttpStatus, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import PgBoss from 'pg-boss';
import type { WhatsAppProvider } from '../../adapters/contratos';
import { WHATSAPP } from '../../adapters/adaptadores.module';
import { PrismaService } from '../../prisma/prisma.service';
import { POLITICA_REINTENTO } from '../auth/reglas-acceso';

export const COLAS = ['whatsapp', 'correo', 'recordatorios', 'ordenes'] as const;
export type NombreCola = (typeof COLAS)[number];

@Injectable()
export class ColaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ColaService.name);
  private boss: PgBoss | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP) private readonly whatsapp: WhatsAppProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      return;
    }
    try {
      const boss = new PgBoss(process.env.DATABASE_URL);
      await boss.start();
      for (const nombre of COLAS) {
        await boss.createQueue(nombre);
        await boss.work(nombre, async (trabajos: { data: object }[]) => {
          for (const trabajo of trabajos) {
            await this.procesar(nombre, trabajo.data);
          }
        });
      }
      this.boss = boss;
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'sin conexión';
      this.logger.warn(`La cola no arrancó. ${detalle}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss?.stop();
  }

  async encolar(nombre: NombreCola, datos: object, opciones: object = POLITICA_REINTENTO): Promise<void> {
    if (!this.boss) {
      throw new HttpException(
        { code: 'internal_error', message: 'La cola de trabajos no está disponible.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    await this.boss.send(nombre, datos, opciones);
  }

  async fallidos(): Promise<{ id: string; nombre: string; reintentos: number; fecha: Date }[]> {
    if (!this.boss) {
      throw new HttpException(
        { code: 'internal_error', message: 'La cola de trabajos no está disponible.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const filas = await this.prisma.$queryRaw<
      { id: string; name: string; retry_count: number; created_on: Date }[]
    >`SELECT id::text, name, retry_count, created_on FROM pgboss.job WHERE state = 'failed' ORDER BY created_on DESC LIMIT 50`;
    return filas.map((fila) => ({
      id: fila.id,
      nombre: fila.name,
      reintentos: fila.retry_count,
      fecha: fila.created_on,
    }));
  }

  private async procesar(nombre: NombreCola, datos: object): Promise<void> {
    const cuerpo = datos as { destino?: string; texto?: string; fallo?: boolean };
    if (cuerpo.fallo) {
      throw new Error('Fallo de prueba de la cola.');
    }
    if (nombre === 'whatsapp' && cuerpo.destino && cuerpo.texto) {
      await this.whatsapp.enviarTexto(cuerpo.destino, cuerpo.texto);
    }
    if (nombre === 'correo' && cuerpo.destino && cuerpo.texto) {
      this.logger.log(`Correo encolado para ${cuerpo.destino}`);
    }
  }
}
