import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { SesionGuard } from '../auth/sesion.guard';

@Controller('api/notificaciones')
@UseGuards(SesionGuard, PermisoGuard)
export class NotificacionesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listar(@Req() peticion: Request) {
    return this.prisma.notificacion.findMany({
      where: { usuarioId: peticion.usuario!.id },
      orderBy: { fecha: 'desc' },
      take: 30,
      select: {
        id: true,
        titulo: true,
        cuerpo: true,
        fecha: true,
        evento: true,
        entregas: { select: { canal: true, estado: true } },
      },
    });
  }

  @Post(':id/leida')
  @CualquierPermiso('tickets.ver_propios', 'tickets.ver_sede')
  async leida(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string) {
    const propia = await this.prisma.notificacion.findFirst({
      where: { id, usuarioId: peticion.usuario!.id },
    });
    if (!propia) {
      return { leida: false };
    }
    await this.prisma.lecturaNotificacion.upsert({
      where: { notificacionId_usuarioId: { notificacionId: id, usuarioId: peticion.usuario!.id } },
      update: {},
      create: { notificacionId: id, usuarioId: peticion.usuario!.id },
    });
    const previa = await this.prisma.notificacionEntrega.findFirst({ where: { notificacionId: id, canal: 'WEB' } });
    if (previa) {
      await this.prisma.notificacionEntrega.update({ where: { id: previa.id }, data: { estado: 'LEIDO' } });
    } else {
      await this.prisma.notificacionEntrega.create({ data: { notificacionId: id, canal: 'WEB', estado: 'LEIDO' } });
    }
    return { leida: true };
  }
}
