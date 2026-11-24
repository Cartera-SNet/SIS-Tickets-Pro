import { Controller, Get, Module, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module';
import { AuthModule } from '../auth/auth.module';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { SesionGuard } from '../auth/sesion.guard';
import { PrismaService } from '../../prisma/prisma.service';
import type { Request } from 'express';
import { Req } from '@nestjs/common';
import { AgenteService } from './agente.service';

@Controller('api/agente')
@UseGuards(SesionGuard, PermisoGuard)
export class AgenteSupervisionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('conversaciones')
  @CualquierPermiso('tickets.ver_sede')
  async listar() {
    const filas = await this.prisma.conversacionIa.findMany({
      orderBy: { fecha: 'desc' },
      take: 40,
      include: {
        usuario: { select: { nombre: true, celularVerificado: true } },
        articulo: { select: { codigo: true, titulo: true } },
        ticket: {
          select: {
            id: true,
            numero: true,
            categoria: { select: { nombre: true } },
            mensajes: {
              orderBy: { fecha: 'asc' },
              take: 30,
              select: { id: true, contenido: true, autorTipo: true, fecha: true, canal: true },
            },
          },
        },
      },
    });
    return filas.map((fila) => {
      const pasos = Array.isArray(fila.decisiones)
        ? (fila.decisiones as { tipo?: string }[]).map((paso) => paso.tipo).filter((tipo): tipo is string => Boolean(tipo))
        : [];
      return {
        id: fila.id,
        usuario: fila.usuario?.nombre ?? 'Sin usuario',
        confianza: fila.confianza,
        transferencia: fila.transferencia,
        articulo: fila.articulo?.titulo ?? null,
        articuloCodigo: fila.articulo?.codigo ?? null,
        ticket: fila.ticket?.numero ?? null,
        ticketId: fila.ticket?.id ?? null,
        celularVerificado: fila.usuario?.celularVerificado ?? false,
        categoria: fila.ticket?.categoria?.nombre ?? null,
        hilo: (fila.ticket?.mensajes ?? []).map((mensaje) => ({
          id: mensaje.id,
          lado: mensaje.autorTipo === 'USUARIO' ? 'usuario' : 'agente',
          texto: mensaje.contenido,
          fecha: mensaje.fecha,
        })),
        fecha: fila.fecha,
        pasos,
        decision: pasos[0] ?? '',
      };
    });
  }

  @Post('conversaciones/:id/tomar')
  @CualquierPermiso('tickets.ver_sede')
  async tomar(@Param('id', ParseUUIDPipe) id: string, @Req() peticion: Request) {
    const actual = await this.prisma.conversacionIa.findUnique({ where: { id } });
    if (!actual) {
      return { tomada: false };
    }
    const previas = Array.isArray(actual.decisiones) ? actual.decisiones : [];
    await this.prisma.conversacionIa.update({
      where: { id },
      data: {
        transferencia: false,
        decisiones: [...previas, { tipo: 'tomada', analistaId: peticion.usuario!.id }] as object,
      },
    });
    return { tomada: true };
  }
}

@Module({
  imports: [TicketsModule, AuthModule],
  controllers: [AgenteSupervisionController],
  providers: [AgenteService],
  exports: [AgenteService],
})
export class AgenteIaModule {}
