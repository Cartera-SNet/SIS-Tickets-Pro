import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly salud: HealthService) {}

  @Get(['health', 'api/health'])
  vivo(): { estado: 'ok' } {
    return this.salud.vivo();
  }

  @Get(['health/ready', 'api/health/ready'])
  async listo(@Res({ passthrough: true }) respuesta: Response): Promise<{
    estado: 'ok' | 'no_disponible';
    chequeos: { baseDatos: 'ok' | 'error' };
  }> {
    const cuerpo = await this.salud.listo();
    respuesta.status(cuerpo.estado === 'ok' ? 200 : 503);
    return cuerpo;
  }
}
