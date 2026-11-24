import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import type { Request } from 'express';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { SesionGuard } from '../auth/sesion.guard';
import { CatalogosService } from './catalogos.service';

class SubcategoriaDto {
  @IsUUID()
  categoriaId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre!: string;
}

class UbicacionDto {
  @IsUUID()
  sedeId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre!: string;

  @IsOptional()
  @IsString()
  piso?: string;

  @IsOptional()
  @IsString()
  puesto?: string;
}

class TipoPatchDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  celularPermitido?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
class NombreDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigo?: string;
}

class TipoPersonalDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsBoolean()
  celularPermitido!: boolean;

  @IsIn(['WEB', 'WHATSAPP', 'CORREO'])
  canalPreferido!: 'WEB' | 'WHATSAPP' | 'CORREO';

  @IsOptional()
  @IsString()
  descripcion?: string;
}

class AnsDto {
  @IsInt()
  @Min(1)
  primeraRespuestaValor!: number;

  @IsIn(['MINUTOS', 'HORAS', 'DIAS_HABILES'])
  primeraRespuestaUnidad!: 'MINUTOS' | 'HORAS' | 'DIAS_HABILES';

  @IsInt()
  @Min(1)
  solucionValor!: number;

  @IsIn(['MINUTOS', 'HORAS', 'DIAS_HABILES'])
  solucionUnidad!: 'MINUTOS' | 'HORAS' | 'DIAS_HABILES';
}

@Controller('api/catalogos')
@UseGuards(SesionGuard, PermisoGuard)
export class CatalogosController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get('categorias')
  categorias() {
    return this.catalogos.categorias();
  }

  @Post('categorias')
  @CualquierPermiso('catalogos.editar')
  crearCategoria(@Body() cuerpo: NombreDto) {
    return this.catalogos.crearCategoria(cuerpo.nombre);
  }

  @Post('subcategorias')
  @CualquierPermiso('catalogos.editar')
  crearSubcategoria(@Body() cuerpo: SubcategoriaDto) {
    return this.catalogos.crearSubcategoria(cuerpo.categoriaId, cuerpo.nombre);
  }

  @Get('sedes')
  sedes() {
    return this.catalogos.sedes();
  }

  @Post('sedes')
  @CualquierPermiso('catalogos.editar')
  crearSede(@Body() cuerpo: NombreDto) {
    return this.catalogos.crearSede(cuerpo.nombre, cuerpo.codigo);
  }

  @Post('ubicaciones')
  @CualquierPermiso('catalogos.editar')
  crearUbicacion(@Body() cuerpo: UbicacionDto) {
    return this.catalogos.crearUbicacion(cuerpo.sedeId, cuerpo.nombre, cuerpo.piso, cuerpo.puesto);
  }

  @Get('tipos-personal')
  tipos() {
    return this.catalogos.tiposPersonal();
  }

  @Post('tipos-personal')
  @CualquierPermiso('catalogos.editar')
  crearTipo(@Body() cuerpo: TipoPersonalDto) {
    return this.catalogos.crearTipoPersonal(cuerpo);
  }

  @Patch('tipos-personal/:id')
  @CualquierPermiso('catalogos.editar')
  editarTipo(@Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: TipoPatchDto) {
    return this.catalogos.editarTipoPersonal(id, cuerpo);
  }

  @Get('prioridades')
  prioridades() {
    return this.catalogos.prioridades();
  }

  @Patch('prioridades/:id')
  @CualquierPermiso('catalogos.editar')
  ans(@Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: AnsDto, @Req() peticion: Request) {
    return this.catalogos.actualizarAns(id, peticion.usuario!.id, cuerpo);
  }

  @Get('equipos')
  equipos(@Req() peticion: Request) {
    const sede = peticion.usuario!.rol === 'ADMINISTRADOR' ? null : peticion.usuario!.sedeId;
    return this.catalogos.equipos(sede);
  }

  @Post('esculapio/sincronizar')
  @CualquierPermiso('catalogos.editar')
  sincronizar() {
    return this.catalogos.sincronizarEsculapioSimulado();
  }
}
