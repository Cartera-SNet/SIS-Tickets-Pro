import { Body, Controller, Get, HttpException, HttpStatus, Injectable, Module, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { dondeTickets, type Principal, type RolAcceso } from '../auth/reglas-acceso';
import { SesionGuard } from '../auth/sesion.guard';
import { AvisosService } from '../notificaciones/avisos.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { Req } from '@nestjs/common';
import type { Request } from 'express';
import { FirmaController, PublicoController } from './firma.controller';
import { FirmaService } from './firma.service';
import { armarBloques } from './bloques';
import { horasRestantes } from './firma-reglas';

class GenerarActaDto {
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @IsOptional()
  @IsUUID()
  ordenId?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(2000)
  diagnostico!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(2000)
  actividades!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  repuestos?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  estadoFinal!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @IsOptional()
  @IsBoolean()
  nuevaVersion?: boolean;
}

@Injectable()
export class ActasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: AvisosService,
  ) {}

  async generar(actor: Principal, entrada: GenerarActaDto) {
    if (Boolean(entrada.ticketId) === Boolean(entrada.ordenId)) {
      throw new HttpException(
        { code: 'validation_error', message: 'Indica el ticket o la orden, solo uno.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (entrada.ticketId) {
      return this.desdeTicket(actor, entrada.ticketId, entrada);
    }
    return this.desdeOrden(actor, entrada.ordenId!, entrada);
  }

  async listar() {
    const filas = await this.prisma.acta.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        numero: true,
        version: true,
        estado: true,
        createdAt: true,
        hash: true,
        ticket: { select: { numero: true } },
        orden: { select: { numero: true } },
        firmas: { select: { rol: true, resultado: true, fecha: true } },
      },
    });
    const ahora = new Date();
    return filas.map((fila) => {
      const tecnico = fila.firmas.find((firma) => firma.rol === 'TECNICO' && firma.resultado === 'FIRMO');
      const desde = tecnico?.fecha ?? fila.createdAt;
      return {
        id: fila.id,
        numero: fila.numero,
        version: fila.version,
        estado: fila.estado,
        createdAt: fila.createdAt,
        sellada: Boolean(fila.hash),
        ticket: fila.ticket,
        orden: fila.orden,
        plazoRestanteHoras: fila.estado === 'PENDIENTE_DE_FIRMA' ? horasRestantes(desde, ahora) : 0,
      };
    });
  }

  private async desdeTicket(actor: Principal, ticketId: string, entrada: GenerarActaDto) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, ...(dondeTickets(actor) as Prisma.TicketWhereInput) },
      include: {
        solicitante: { select: { id: true, nombre: true } },
        sede: { select: { nombre: true } },
        ubicacion: { select: { nombre: true } },
        equipo: { select: { placa: true, serial: true } },
        actas: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!ticket) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el ticket.' }, HttpStatus.NOT_FOUND);
    }
    if (ticket.nivel === 'N1') {
      throw new HttpException(
        { code: 'conflict', message: 'Un caso de N1 se cierra con confirmación, sin acta.' },
        HttpStatus.CONFLICT,
      );
    }
    const previa = ticket.actas[0];
    if (previa && !entrada.nuevaVersion) {
      throw new HttpException(
        { code: 'conflict', message: 'Ya hay un acta. Pide una versión nueva si hay que corregirla.' },
        HttpStatus.CONFLICT,
      );
    }
    const version = previa ? previa.version + 1 : 1;
    const numero = previa?.numero ?? (await this.siguiente('AC'));
    const contenido = armarBloques({
      numero,
      version,
      referencia: ticket.numero,
      solicitante: ticket.solicitante.nombre,
      sede: ticket.sede?.nombre ?? 'Sin sede',
      ubicacion: ticket.ubicacion?.nombre ?? 'Sin ubicación',
      placa: ticket.equipo?.placa ?? null,
      serial: ticket.equipo?.serial ?? null,
      apertura: ticket.fechaCreacion,
      solucion: ticket.fechaResolucion,
      diagnostico: entrada.diagnostico,
      actividades: entrada.actividades,
      repuestos: entrada.repuestos ?? '',
      estadoFinal: entrada.estadoFinal,
      checklist: [],
      observaciones: entrada.observaciones ?? '',
    });
    const acta = await this.prisma.acta.create({
      data: {
        numero,
        version,
        ticketId: ticket.id,
        contenido: contenido as unknown as Prisma.InputJsonValue,
        estado: 'PENDIENTE_DE_FIRMA',
      },
    });
    await this.prisma.historial.create({
      data: {
        ticketId: ticket.id,
        usuarioId: actor.id,
        tipo: 'acta_generada',
        datosNuevos: { numero, version },
      },
    });
    await this.avisos.avisar({
      evento: 'acta_pendiente',
      usuarios: [ticket.solicitante.id],
      titulo: `Acta ${numero} pendiente de firma`,
      cuerpo: 'El documento está listo. La firma llega en el siguiente paso.',
      clave: () => `acta_pendiente:${acta.id}`,
    });
    return { id: acta.id, numero, version, estado: acta.estado, contenido };
  }

  private async desdeOrden(actor: Principal, ordenId: string, entrada: GenerarActaDto) {
    const orden = await this.prisma.ordenPreventiva.findUnique({
      where: { id: ordenId },
      include: {
        equipo: { include: { sede: true, ubicacion: true, responsable: true } },
        actas: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!orden) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró la orden.' }, HttpStatus.NOT_FOUND);
    }
    const previa = orden.actas[0];
    if (previa && !entrada.nuevaVersion) {
      throw new HttpException(
        { code: 'conflict', message: 'Ya hay un acta. Pide una versión nueva si hay que corregirla.' },
        HttpStatus.CONFLICT,
      );
    }
    const version = previa ? previa.version + 1 : 1;
    const numero = previa?.numero ?? (await this.siguiente('AC-P'));
    const checklist = Array.isArray(orden.resultados) ? orden.resultados : [];
    const contenido = armarBloques({
      numero,
      version,
      referencia: orden.numero,
      solicitante: orden.equipo.responsable?.nombre ?? 'Jefe del área',
      sede: orden.equipo.sede?.nombre ?? 'Sin sede',
      ubicacion: orden.equipo.ubicacion?.nombre ?? 'Sin ubicación',
      placa: orden.equipo.placa,
      serial: orden.equipo.serial,
      apertura: orden.createdAt,
      solucion: null,
      diagnostico: entrada.diagnostico,
      actividades: entrada.actividades,
      repuestos: entrada.repuestos ?? '',
      estadoFinal: entrada.estadoFinal,
      checklist,
      observaciones: entrada.observaciones ?? '',
    });
    const acta = await this.prisma.acta.create({
      data: {
        numero,
        version,
        ordenId: orden.id,
        contenido: contenido as unknown as Prisma.InputJsonValue,
        estado: 'PENDIENTE_DE_FIRMA',
      },
    });
    await this.prisma.historial.create({
      data: {
        ordenId: orden.id,
        usuarioId: actor.id,
        tipo: 'acta_generada',
        datosNuevos: { numero, version },
      },
    });
    return { id: acta.id, numero, version, estado: acta.estado, contenido };
  }

  private async siguiente(prefijo: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      await tx.consecutivo.upsert({ where: { prefijo }, update: {}, create: { prefijo, valor: 0 } });
      const fila = await tx.consecutivo.update({ where: { prefijo }, data: { valor: { increment: 1 } } });
      const base = prefijo === 'AC-P' ? 'AC-P' : 'AC';
      return `${base}-${String(fila.valor).padStart(4, '0')}`;
    });
  }
}

@Controller('api/actas')
@UseGuards(SesionGuard, PermisoGuard)
export class ActasController {
  constructor(private readonly actas: ActasService) {}

  @Get()
  @CualquierPermiso('actas.firmar', 'reportes.ver')
  listar() {
    return this.actas.listar();
  }

  @Post()
  @CualquierPermiso('actas.firmar')
  generar(@Req() peticion: Request, @Body() cuerpo: GenerarActaDto) {
    const usuario = peticion.usuario!;
    return this.actas.generar(
      { id: usuario.id, rol: usuario.rol as RolAcceso, sedeId: usuario.sedeId, niveles: usuario.niveles },
      cuerpo,
    );
  }
}

@Module({
  imports: [AuthModule, NotificacionesModule],
  controllers: [ActasController, FirmaController, PublicoController],
  providers: [ActasService, FirmaService],
  exports: [ActasService],
})
export class ActasModule {}
