import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import type { Request } from 'express';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import type { RolAcceso } from '../auth/reglas-acceso';
import { SesionGuard } from '../auth/sesion.guard';
import type { Frecuencia, ItemChecklist, ResultadoItem } from './preventivo-reglas';
import { PreventivoService } from './preventivo.service';

class EquipoDto {
  @IsOptional() @IsString() placa?: string;
  @IsOptional() @IsString() serial?: string;
  @IsString() @MinLength(2) tipo!: string;
  @IsOptional() @IsString() marca?: string;
  @IsOptional() @IsString() modelo?: string;
  @IsUUID() sedeId!: string;
  @IsOptional() @IsUUID() areaId?: string;
  @IsOptional() @IsUUID() ubicacionId?: string;
  @IsOptional() @IsUUID() responsableId?: string;
  @IsOptional() @IsString() estado?: string;
}

class PlanDto {
  @IsString() @MinLength(3) nombre!: string;
  @IsString() tipoEquipo!: string;
  @IsIn(['TRIMESTRAL', 'SEMESTRAL', 'ANUAL']) frecuencia!: Frecuencia;
  @IsArray() items!: ItemChecklist[];
  @IsOptional() @IsArray() areaIds?: string[];
  @IsOptional() @IsArray() equipoIds?: string[];
}

class EjecutarDto {
  @IsArray() resultados!: ResultadoItem[];
}

class ReprogramarDto {
  @IsString() fecha!: string;
  @IsString() @MinLength(4) motivo!: string;
}

class CorrectivoDto {
  @IsString() @MinLength(4) titulo!: string;
  @IsString() @MinLength(8) descripcion!: string;
}

class DelegadoDto {
  @IsUUID() delegadoId!: string;
  @IsUUID() areaId!: string;
}

function principal(peticion: Request) {
  const usuario = peticion.usuario!;
  return { id: usuario.id, rol: usuario.rol as RolAcceso, sedeId: usuario.sedeId, niveles: usuario.niveles };
}

@Controller('api/preventivo')
@UseGuards(SesionGuard, PermisoGuard)
export class PreventivoController {
  constructor(private readonly preventivo: PreventivoService) {}

  @Get('equipos')
  @CualquierPermiso('catalogos.editar', 'preventivo.ejecutar', 'reportes.ver')
  equipos() {
    return this.preventivo.equipos();
  }

  @Post('equipos')
  @CualquierPermiso('catalogos.editar')
  crearEquipo(@Body() cuerpo: EquipoDto) {
    return this.preventivo.crearEquipo(cuerpo);
  }

  @Get('planes')
  @CualquierPermiso('catalogos.editar', 'preventivo.ejecutar', 'reportes.ver')
  planes() {
    return this.preventivo.planes();
  }

  @Post('planes')
  @CualquierPermiso('catalogos.editar')
  crearPlan(@Body() cuerpo: PlanDto) {
    return this.preventivo.crearPlan(cuerpo);
  }

  @Post('generar')
  @CualquierPermiso('configuracion.editar')
  generar() {
    return this.preventivo.generar();
  }

  @Get('calendario')
  @CualquierPermiso('reportes.ver', 'preventivo.ejecutar')
  calendario(@Query('mes') mes = '') {
    const actual = mes || new Date().toISOString().slice(0, 7);
    return this.preventivo.calendario(actual);
  }

  @Get('cumplimiento')
  @CualquierPermiso('reportes.ver')
  cumplimiento(@Query('desde') desde: string, @Query('hasta') hasta: string) {
    const hoy = new Date();
    const inicio = desde || new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
    const fin = hasta || new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1).toISOString();
    return this.preventivo.medir(inicio, fin);
  }

  @Post('vencer')
  @CualquierPermiso('configuracion.editar')
  vencer() {
    return this.preventivo.vencer();
  }

  @Get('equipos/:id/historial')
  @CualquierPermiso('catalogos.editar', 'reportes.ver', 'preventivo.ejecutar')
  historial(@Param('id', ParseUUIDPipe) id: string) {
    return this.preventivo.historialEquipo(id);
  }

  @Get('ordenes/:id')
  @CualquierPermiso('preventivo.ejecutar', 'reportes.ver')
  orden(@Param('id', ParseUUIDPipe) id: string) {
    return this.preventivo.orden(id);
  }

  @Post('ordenes/:id/ejecutar')
  @CualquierPermiso('preventivo.ejecutar')
  ejecutar(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: EjecutarDto) {
    return this.preventivo.ejecutar(principal(peticion), id, cuerpo.resultados);
  }

  @Post('ordenes/:id/reprogramar')
  @CualquierPermiso('preventivo.ejecutar')
  reprogramar(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: ReprogramarDto) {
    return this.preventivo.reprogramar(principal(peticion), id, cuerpo.fecha, cuerpo.motivo);
  }

  @Post('ordenes/:id/correctivo')
  @CualquierPermiso('preventivo.ejecutar', 'tickets.crear')
  correctivo(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: CorrectivoDto) {
    return this.preventivo.correctivo(principal(peticion), id, cuerpo.titulo, cuerpo.descripcion);
  }

  @Get('delegados')
  @CualquierPermiso('tickets.ver_propios', 'usuarios.administrar')
  delegados(@Query('areaId') areaId?: string) {
    return this.preventivo.delegados(areaId);
  }

  @Post('delegados')
  @CualquierPermiso('tickets.ver_propios', 'usuarios.administrar')
  delegar(@Req() peticion: Request, @Body() cuerpo: DelegadoDto) {
    return this.preventivo.registrarDelegado(peticion.usuario!.id, cuerpo.delegadoId, cuerpo.areaId);
  }
}
