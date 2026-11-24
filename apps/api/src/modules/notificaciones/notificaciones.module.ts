import { Body, Controller, Get, Module, Put, Req, UseGuards } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { AuthModule } from '../auth/auth.module';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { SesionGuard } from '../auth/sesion.guard';
import { AvisosService } from './avisos.service';
import { matrizValida } from './matriz';
import { NotificacionesController } from './notificaciones.controller';
import { TiempoRealGateway } from './tiempo-real.gateway';

@Controller('api/notificaciones/matriz')
@UseGuards(SesionGuard, PermisoGuard)
export class MatrizController {
  constructor(private readonly avisos: AvisosService) {}

  @Get()
  @CualquierPermiso('configuracion.editar')
  leer() {
    return this.avisos.leerMatriz();
  }

  @Put()
  @CualquierPermiso('configuracion.editar')
  guardar(@Req() peticion: Request, @Body() cuerpo: unknown) {
    if (!matrizValida(cuerpo)) {
      throw new HttpException(
        { code: 'validation_error', message: 'La matriz debe incluir los quince eventos con canal si, no u opcional.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.avisos.guardarMatriz(cuerpo, peticion.usuario!.id);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [NotificacionesController, MatrizController],
  providers: [TiempoRealGateway, AvisosService],
  exports: [AvisosService],
})
export class NotificacionesModule {}
