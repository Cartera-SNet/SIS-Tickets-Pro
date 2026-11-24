import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { SesionGuard } from '../auth/sesion.guard';
import { ColaService } from './cola.service';

@Controller('api/cola')
@UseGuards(SesionGuard, PermisoGuard)
export class ColaController {
  constructor(private readonly cola: ColaService) {}

  @Get('fallidos')
  @CualquierPermiso('configuracion.editar')
  fallidos() {
    return this.cola.fallidos();
  }

  @Post('ensayo')
  @CualquierPermiso('configuracion.editar')
  ensayo() {
    return this.cola.encolar('correo', { fallo: true }, { retryLimit: 0, retryDelay: 0, retryBackoff: false });
  }
}
