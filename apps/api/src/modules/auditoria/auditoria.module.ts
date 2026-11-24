import { Controller, Get, Module, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { dondeTickets, type Principal, type RolAcceso } from '../auth/reglas-acceso';
import { SesionGuard } from '../auth/sesion.guard';

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async deTicket(actor: Principal, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, ...(dondeTickets(actor) as Prisma.TicketWhereInput) },
      include: {
        solicitante: { select: { celular: true, nombre: true } },
        historial: { orderBy: { fecha: 'asc' }, include: { usuario: { select: { nombre: true } } } },
        conversaciones: { orderBy: { fecha: 'asc' } },
        actas: { include: { firmas: { include: { firmante: { select: { nombre: true } } } } } },
        mensajes: { orderBy: { fecha: 'asc' }, select: { canal: true, contenido: true, estadoEntrega: true, fecha: true } },
      },
    });
    if (!ticket) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el ticket.' }, HttpStatus.NOT_FOUND);
    }
    const envios = ticket.solicitante.celular
      ? await this.prisma.envioWhatsapp.findMany({
          where: { telefono: ticket.solicitante.celular, actualizado: { gte: ticket.fechaCreacion } },
          orderBy: { actualizado: 'asc' },
          take: 40,
        })
      : [];
    const linea = [
      ...ticket.historial.map((fila) => ({
        fecha: fila.fecha,
        tipo: fila.tipo,
        quien: fila.usuario?.nombre ?? 'Sistema',
        detalle: fila.datosNuevos,
      })),
      ...ticket.conversaciones.map((fila) => ({
        fecha: fila.fecha,
        tipo: 'decision_agente',
        quien: 'Agente IA',
        detalle: { confianza: fila.confianza, transferencia: fila.transferencia, decisiones: fila.decisiones },
      })),
      ...ticket.mensajes.map((fila) => ({
        fecha: fila.fecha,
        tipo: 'mensaje',
        quien: fila.canal,
        detalle: { estadoEntrega: fila.estadoEntrega, contenido: fila.contenido },
      })),
      ...envios.map((fila) => ({
        fecha: fila.actualizado,
        tipo: 'entrega_whatsapp',
        quien: fila.telefono,
        detalle: { estado: fila.estado, plantilla: fila.plantilla },
      })),
      ...ticket.actas.flatMap((acta) =>
        acta.firmas.map((firma) => ({
          fecha: firma.fecha,
          tipo: 'firma',
          quien: firma.firmante.nombre,
          detalle: { resultado: firma.resultado, metodo: firma.metodo, motivo: firma.motivoRechazo },
        })),
      ),
    ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    return { numero: ticket.numero, linea };
  }
}

@Controller('api/auditoria')
@UseGuards(SesionGuard, PermisoGuard)
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get('tickets/:id')
  @CualquierPermiso('tickets.ver_propios', 'tickets.ver_sede')
  ticket(@Req() peticion: Request, @Param('id', ParseUUIDPipe) id: string) {
    const usuario = peticion.usuario!;
    return this.auditoria.deTicket(
      { id: usuario.id, rol: usuario.rol as RolAcceso, sedeId: usuario.sedeId, niveles: usuario.niveles },
      id,
    );
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
})
export class AuditoriaModule {}
