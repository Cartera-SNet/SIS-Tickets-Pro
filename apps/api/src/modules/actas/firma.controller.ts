import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Length, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import type { RolAcceso } from '../auth/reglas-acceso';
import { SesionGuard } from '../auth/sesion.guard';
import { FirmaService } from './firma.service';

class ImagenDto {
  @IsOptional()
  @IsString()
  imagen?: string;
}

class CodigoDto extends ImagenDto {
  @IsString()
  @Length(6, 6)
  codigo!: string;
}

class RechazoCodigoDto extends CodigoDto {
  @IsString()
  @MinLength(4)
  motivo!: string;
}

class RecordatorioDto {
  @IsOptional()
  @IsString()
  ahora?: string;
}

class RechazoPublicoDto {
  @IsString()
  @MinLength(4)
  motivo!: string;

  @IsOptional()
  @IsString()
  imagen?: string;
}

function principal(peticion: Request) {
  const usuario = peticion.usuario!;
  return {
    id: usuario.id,
    rol: usuario.rol as RolAcceso,
    sedeId: usuario.sedeId,
    niveles: usuario.niveles,
  };
}

@Controller('api/actas')
@UseGuards(SesionGuard, PermisoGuard)
export class FirmaController {
  constructor(private readonly firmas: FirmaService) {}

  @Post('recordatorios')
  @CualquierPermiso('configuracion.editar')
  recordar(@Body() cuerpo: RecordatorioDto) {
    return this.firmas.recordar(cuerpo.ahora ? new Date(cuerpo.ahora) : new Date());
  }

  @Post(':id/firma-tecnico')
  @CualquierPermiso('actas.firmar')
  tecnico(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: ImagenDto) {
    return this.firmas.firmarTecnico(principal(peticion), id, cuerpo.imagen, peticion);
  }

  @Post(':id/codigo')
  @CualquierPermiso('actas.firmar')
  codigo(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.firmas.pedirCodigo(principal(peticion), id);
  }

  @Post(':id/firma-solicitante')
  @CualquierPermiso('actas.firmar')
  solicitante(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: CodigoDto) {
    return this.firmas.firmarSolicitante(principal(peticion), id, cuerpo.codigo, cuerpo.imagen, peticion);
  }

  @Post(':id/rechazar')
  @CualquierPermiso('actas.firmar')
  rechazar(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: RechazoCodigoDto) {
    return this.firmas.rechazarConCodigo(principal(peticion), id, cuerpo.codigo, cuerpo.motivo, peticion);
  }

  @Post(':id/enlace')
  @CualquierPermiso('actas.firmar')
  enlace(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.firmas.crearEnlace(principal(peticion), id);
  }

  @Get(':id/pdf')
  @CualquierPermiso('actas.firmar', 'tickets.ver_propios')
  @Header('Content-Type', 'application/pdf')
  async pdf(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string, @Res() respuesta: Response) {
    const archivo = await this.firmas.leerPdf(principal(peticion), id);
    respuesta.setHeader('Content-Type', 'application/pdf');
    respuesta.send(archivo);
  }
}

@Controller('api/publico')
export class PublicoController {
  constructor(private readonly firmas: FirmaService) {}

  @Get('verificar')
  verificar(@Query('codigo') codigo = '') {
    return this.firmas.verificar(codigo);
  }

  @Get('firmar/:token')
  ver(@Param('token') token: string) {
    return this.firmas.verPublico(token);
  }

  @Post('firmar/:token')
  firmar(@Param('token') token: string, @Body() cuerpo: ImagenDto, @Req() peticion: Request) {
    return this.firmas.firmarPublico(token, cuerpo.imagen, peticion);
  }

  @Post('firmar/:token/rechazar')
  rechazar(@Param('token') token: string, @Body() cuerpo: RechazoPublicoDto, @Req() peticion: Request) {
    return this.firmas.rechazarPublico(token, cuerpo.motivo, peticion);
  }
}
