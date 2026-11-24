import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Request } from 'express';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { SesionGuard } from '../auth/sesion.guard';
import type { RolAcceso } from '../auth/reglas-acceso';
import type { EstadoTicket } from './maquina-estados';
import { TicketsService } from './tickets.service';

class CrearTicketDto {
  @IsUUID()
  categoriaId!: string;

  @IsOptional()
  @IsUUID()
  subcategoriaId?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(120)
  titulo!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(4000)
  descripcion!: string;

  @IsUUID()
  ubicacionId!: string;

  @IsOptional()
  @IsUUID()
  equipoId?: string;

  @IsBoolean()
  puedeTrabajar!: boolean;

  @IsInt()
  @Min(1)
  personas!: number;

  @IsBoolean()
  areaCompleta!: boolean;
}

class ConfirmarDto {
  @IsBoolean()
  confirmar!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  calificacion?: number;
}

class MensajeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  contenido!: string;
}

class EstadoDto {
  @IsString()
  estado!: EstadoTicket;

  @IsOptional()
  @IsString()
  solucionAplicada?: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}

@Controller('api/tickets')
@UseGuards(SesionGuard, PermisoGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @CualquierPermiso('tickets.ver_propios', 'tickets.ver_sede')
  listar(@Req() peticion: Request, @Query('limit') limite?: string, @Query('cursor') cursor?: string) {
    const pedido = Number(limite ?? 20);
    return this.tickets.listar(principalDe(peticion), Number.isInteger(pedido) ? pedido : 20, cursor, {
      categoriaId: peticion.query.categoriaId as string | undefined,
      nivel: peticion.query.nivel as string | undefined,
      estado: peticion.query.estado as string | undefined,
      sedeId: peticion.query.sedeId as string | undefined,
      canal: peticion.query.canal as string | undefined,
    });
  }

  @Post('plazos')
  @CualquierPermiso('configuracion.editar')
  plazos() {
    return this.tickets.revisarPlazos();
  }

  @Get('asignacion/carga')
  @CualquierPermiso('tickets.asignar', 'tickets.escalar')
  carga(@Req() peticion: Request) {
    return this.tickets.carga(principalDe(peticion));
  }

  @Get(':id')
  @CualquierPermiso('tickets.ver_propios', 'tickets.ver_sede')
  detalle(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.detalle(principalDe(peticion), id);
  }

  @Post(':id/mensajes')
  @CualquierPermiso('tickets.ver_propios', 'tickets.ver_sede')
  comentar(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: MensajeDto) {
    return this.tickets.comentar(principalDe(peticion), id, cuerpo.contenido);
  }

  @Post(':id/adjuntos')
  @CualquierPermiso('tickets.ver_propios', 'tickets.ver_sede')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  adjuntar(
    @Req() peticion: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() archivo: { originalname: string; buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.tickets.adjuntar(principalDe(peticion), id, archivo);
  }

  @Get(':id/adjuntos/:adjuntoId')
  @CualquierPermiso('tickets.ver_propios', 'tickets.ver_sede')
  descargar(
    @Req() peticion: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('adjuntoId', ParseUUIDPipe) adjuntoId: string,
  ) {
    return this.tickets.descargar(principalDe(peticion), id, adjuntoId);
  }

  @Post(':id/escalar')
  @CualquierPermiso('tickets.escalar')
  escalar(
    @Req() peticion: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cuerpo: { nivelDestino: 'N1' | 'N2' | 'N3'; motivo: string; acciones: string; responsableId: string },
  ) {
    return this.tickets.escalar(principalDe(peticion), id, cuerpo);
  }

  @Get(':id/ruta')
  @CualquierPermiso('tickets.ver_propios', 'tickets.ver_sede')
  ruta(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.ruta(principalDe(peticion), id);
  }

  @Post(':id/asignar')
  @CualquierPermiso('tickets.asignar')
  asignar(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: { responsableId: string }) {
    return this.tickets.asignar(principalDe(peticion), id, cuerpo.responsableId);
  }

  @Post(':id/reabrir-descarte')
  @CualquierPermiso('descartes.revisar')
  reabrir(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.reabrirDescarte(principalDe(peticion), id);
  }

  @Post(':id/confirmacion')
  @CualquierPermiso('tickets.calificar')
  confirmar(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: ConfirmarDto) {
    return this.tickets.confirmar(principalDe(peticion), id, cuerpo);
  }

  @Post()
  @CualquierPermiso('tickets.crear')
  crear(@Req() peticion: Request, @Body() cuerpo: CrearTicketDto) {
    return this.tickets.crear(peticion.usuario!.id, cuerpo);
  }

  @Post(':id/estado')
  @CualquierPermiso('tickets.resolver')
  estado(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: EstadoDto) {
    return this.tickets.cambiarEstado(principalDe(peticion), id, cuerpo.estado, cuerpo);
  }
}

function principalDe(peticion: Request) {
  const usuario = peticion.usuario!;
  return {
    id: usuario.id,
    rol: usuario.rol as RolAcceso,
    sedeId: usuario.sedeId,
    niveles: usuario.niveles,
  };
}
