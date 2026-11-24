import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AprobarDto } from './auth.dto';
import { AuthService } from './auth.service';
import { CualquierPermiso, PermisoGuard } from './permiso.guard';
import { SesionGuard } from './sesion.guard';

class SinCorreoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  nombre!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  celular!: string;

  @IsUUID()
  sedeId!: string;

  @IsUUID()
  areaId!: string;

  @IsUUID()
  tipoPersonalId!: string;
}

@Controller('api/usuarios')
@UseGuards(SesionGuard, PermisoGuard)
export class UsuariosController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':id/aprobacion')
  @CualquierPermiso('usuarios.administrar')
  aprobar(@Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: AprobarDto) {
    return this.auth.cambiarAprobacion(id, cuerpo.estado);
  }

  @Get()
  @CualquierPermiso('usuarios.administrar')
  listar() {
    return this.prisma.usuario.findMany({
      where: { deletedAt: null },
      orderBy: { nombre: 'asc' },
      take: 100,
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
        esJefeArea: true,
        celular: true,
        correoGoogle: true,
        sede: { select: { id: true, nombre: true } },
        area: { select: { id: true, nombre: true } },
      },
    });
  }

  @Patch(':id')
  @CualquierPermiso('usuarios.administrar')
  async editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cuerpo: { rol?: 'SOLICITANTE' | 'TECNICO' | 'ADMINISTRADOR'; sedeId?: string; areaId?: string; activo?: boolean; esJefeArea?: boolean },
    @Req() peticion: Request,
  ) {
    const previo = await this.prisma.usuario.findUnique({ where: { id }, select: { rol: true, sedeId: true, areaId: true, activo: true, esJefeArea: true } });
    const actualizado = await this.prisma.usuario.update({
      where: { id },
      data: {
        rol: cuerpo.rol,
        sedeId: cuerpo.sedeId,
        areaId: cuerpo.areaId,
        activo: cuerpo.activo,
        esJefeArea: cuerpo.esJefeArea,
        deletedAt: cuerpo.activo === false ? new Date() : null,
      },
      select: { id: true, nombre: true, rol: true, activo: true },
    });
    await this.prisma.historial.create({
      data: {
        usuarioId: peticion.usuario!.id,
        tipo: 'usuario',
        datosPrevios: previo ?? undefined,
        datosNuevos: { usuarioId: id, ...cuerpo },
      },
    });
    return actualizado;
  }

  @Post(':id/delegados')
  @CualquierPermiso('usuarios.administrar')
  delegar(@Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: { delegadoId: string; areaId: string }) {
    return this.prisma.delegadoArea.upsert({
      where: { delegadoId_areaId: { delegadoId: cuerpo.delegadoId, areaId: cuerpo.areaId } },
      update: { jefeId: id, activo: true },
      create: { jefeId: id, delegadoId: cuerpo.delegadoId, areaId: cuerpo.areaId },
      select: { id: true, jefeId: true, delegadoId: true, areaId: true, activo: true },
    });
  }

  @Post('sin-correo')
  @CualquierPermiso('usuarios.administrar')
  sinCorreo(@Body() cuerpo: SinCorreoDto) {
    return this.prisma.usuario.create({
      data: {
        nombre: cuerpo.nombre.trim(),
        celular: cuerpo.celular.trim(),
        celularVerificado: false,
        rol: 'SOLICITANTE',
        estadoAprobacion: 'APROBADO',
        sedeId: cuerpo.sedeId,
        areaId: cuerpo.areaId,
        tipoPersonalId: cuerpo.tipoPersonalId,
      },
      select: { id: true, nombre: true, celular: true, rol: true, estadoAprobacion: true },
    });
  }
}
