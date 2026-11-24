import { ESTADO_TICKET } from '@sis/shared';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join, resolve } from 'node:path';
import { HttpException, HttpStatus, Injectable, StreamableFile } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dondeTickets, type Principal } from '../auth/reglas-acceso';
import { prioridadPorImpacto, sumarTiempoHabil, type Unidad } from './ans';
import { puedeTransicionar, type EstadoTicket } from './maquina-estados';
import { validarEscalamiento, type Nivel } from './escalamiento';
import { debeReabrirSinConfirmacion, estaPorVencer } from './vigilancia';
import { AvisosService } from '../notificaciones/avisos.service';

const EXTENSIONES = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.txt', '.webp']);
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: AvisosService,
  ) {}

  async listar(
    principal: Principal,
    limite: number,
    cursor?: string,
    filtros: { categoriaId?: string; nivel?: string; estado?: string; sedeId?: string; canal?: string } = {},
  ) {
    const take = Math.min(Math.max(limite, 1), 50);
    const alcance = dondeTickets(principal) as Prisma.TicketWhereInput;
    const where: Prisma.TicketWhereInput = {
      ...alcance,
      ...(filtros.categoriaId ? { categoriaId: filtros.categoriaId } : {}),
      ...(filtros.nivel ? { nivel: filtros.nivel as Prisma.TicketWhereInput['nivel'] } : {}),
      ...(filtros.estado ? { estado: filtros.estado as Prisma.TicketWhereInput['estado'] } : {}),
      ...(filtros.sedeId ? { sedeId: filtros.sedeId } : {}),
      ...(filtros.canal ? { canalOrigen: filtros.canal as Prisma.TicketWhereInput['canalOrigen'] } : {}),
    };
    try {
      const filas = await this.prisma.ticket.findMany({
        where,
        take: take + 1,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { fechaCreacion: 'desc' },
        select: {
          id: true,
          numero: true,
          titulo: true,
          estado: true,
          nivel: true,
          canalOrigen: true,
          fechaObjetivoSolucion: true,
          categoria: { select: { nombre: true } },
        },
      });
      const hayMas = filas.length > take;
      const items = (hayMas ? filas.slice(0, take) : filas).map((item) => ({
        id: item.id,
        numero: item.numero,
        titulo: item.titulo,
        estado: item.estado,
        estadoNombre: ESTADO_TICKET[item.estado],
        nivel: item.nivel,
        canal: item.canalOrigen,
        categoria: item.categoria?.nombre ?? '',
        fechaObjetivoSolucion: item.fechaObjetivoSolucion,
      }));
      return { items, nextCursor: hayMas ? items.at(-1)?.id ?? null : null, limit: take };
    } catch (error) {
      const texto = error instanceof Error ? error.message : '';
      if (/Can't reach database|ECONNREFUSED|P1001|P2021/.test(texto)) {
        throw new HttpException(
          { code: 'internal_error', message: 'La base de datos no está disponible.' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw error;
    }
  }

  async crear(
    solicitanteId: string,
    entrada: {
      categoriaId: string;
      subcategoriaId?: string;
      titulo: string;
      descripcion: string;
      ubicacionId: string;
      equipoId?: string;
      puedeTrabajar: boolean;
      personas: number;
      areaCompleta: boolean;
    },
  ) {
    const codigo = prioridadPorImpacto({
      puedeTrabajar: entrada.puedeTrabajar,
      personas: entrada.personas,
      areaCompleta: entrada.areaCompleta,
    });
    const creado = await this.prisma.$transaction(async (tx) => {
      const consecutivo = await tx.consecutivo.update({
        where: { prefijo: 'MA' },
        data: { valor: { increment: 1 } },
      });
      const ubicacion = await tx.ubicacion.findFirst({ where: { id: entrada.ubicacionId, deletedAt: null } });
      if (!ubicacion) {
        throw new HttpException({ code: 'not_found', message: 'No se encontró la ubicación.' }, HttpStatus.NOT_FOUND);
      }
      const prioridad = await tx.prioridad.findUnique({ where: { codigo } });
      if (!prioridad) {
        throw new HttpException({ code: 'not_found', message: 'No hay prioridades configuradas.' }, HttpStatus.NOT_FOUND);
      }
      const ahora = new Date();
      const ticket = await tx.ticket.create({
        data: {
          numero: `MA-${String(consecutivo.valor).padStart(4, '0')}`,
          tipo: 'CORRECTIVO',
          canalOrigen: 'WEB',
          solicitanteId,
          categoriaId: entrada.categoriaId,
          subcategoriaId: entrada.subcategoriaId || null,
          titulo: entrada.titulo.trim(),
          descripcion: entrada.descripcion.trim(),
          sedeId: ubicacion.sedeId,
          ubicacionId: ubicacion.id,
          equipoId: entrada.equipoId || null,
          impactoPuedeTrabajar: entrada.puedeTrabajar,
          impactoPersonas: entrada.personas,
          prioridadId: prioridad.id,
          nivel: 'N1',
          estado: 'NUEVO',
          fechaObjetivoPrimeraRespuesta: sumarTiempoHabil(
            ahora,
            prioridad.primeraRespuestaValor,
            prioridad.primeraRespuestaUnidad as Unidad,
          ),
          fechaObjetivoSolucion: sumarTiempoHabil(ahora, prioridad.solucionValor, prioridad.solucionUnidad as Unidad),
        },
      });
      await tx.historial.create({
        data: {
          ticketId: ticket.id,
          usuarioId: solicitanteId,
          tipo: 'creacion',
          datosNuevos: { numero: ticket.numero, estado: 'NUEVO', prioridad: codigo },
        },
      });
      return {
        id: ticket.id,
        numero: ticket.numero,
        estado: ticket.estado,
        estadoNombre: ESTADO_TICKET.NUEVO,
        prioridad: codigo,
      };
    });
    await this.avisos
      .avisar({
        evento: 'ticket_creado',
        usuarios: [solicitanteId],
        titulo: `${creado.numero} fue creado`,
        cuerpo: 'Tu caso quedó registrado.',
        clave: () => `ticket_creado:${creado.id}`,
      })
      .catch(() => undefined);
    return creado;
  }

  async cambiarEstado(
    actor: Principal,
    ticketId: string,
    destino: EstadoTicket,
    entrada: { solucionAplicada?: string; motivo?: string },
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, ...(dondeTickets(actor) as Prisma.TicketWhereInput) },
      include: { historial: { select: { datosNuevos: true } } },
    });
    if (!ticket) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el ticket.' }, HttpStatus.NOT_FOUND);
    }
    const estuvoEnSitio =
      ticket.estado === 'EN_SITIO' ||
      ticket.historial.some((fila) => JSON.stringify(fila.datosNuevos).includes('EN_SITIO'));
    const decision = puedeTransicionar(ticket.estado, destino, {
      solucionAplicada: entrada.solucionAplicada ?? ticket.solucionAplicada,
      motivo: entrada.motivo,
      estuvoEnSitio,
      actaFirmada: false,
      plazoFirmaVencido: false,
    });
    if (!decision.ok) {
      throw new HttpException({ code: 'conflict', message: decision.mensaje }, HttpStatus.CONFLICT);
    }
    const actualizado = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        estado: destino,
        solucionAplicada: entrada.solucionAplicada?.trim() || ticket.solucionAplicada,
        motivoDescarte: destino === 'DESCARTADO' ? entrada.motivo?.trim() : ticket.motivoDescarte,
        fechaResolucion: destino === 'RESUELTO' ? new Date() : ticket.fechaResolucion,
      },
    });
    await this.prisma.historial.create({
      data: {
        ticketId: ticket.id,
        usuarioId: actor.id,
        tipo: 'cambio_estado',
        datosPrevios: { estado: ticket.estado },
        datosNuevos: { estado: destino },
      },
    });
    return { id: actualizado.id, numero: actualizado.numero, estado: actualizado.estado, estadoNombre: ESTADO_TICKET[destino] };
  }

  async detalle(actor: Principal, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, ...(dondeTickets(actor) as Prisma.TicketWhereInput) },
      include: {
        categoria: true,
        subcategoria: true,
        prioridad: true,
        sede: true,
        ubicacion: true,
        equipo: true,
        solicitante: { select: { id: true, nombre: true } },
        responsable: { select: { id: true, nombre: true } },
        mensajes: { orderBy: { fecha: 'asc' }, include: { autor: { select: { nombre: true } } } },
        adjuntos: { orderBy: { createdAt: 'asc' } },
        historial: { orderBy: { fecha: 'asc' } },
      },
    });
    if (!ticket) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el ticket.' }, HttpStatus.NOT_FOUND);
    }
    const ahora = new Date();
    return {
      ...ticket,
      estadoNombre: ESTADO_TICKET[ticket.estado],
      porVencer: ticket.fechaObjetivoSolucion
        ? estaPorVencer(ticket.fechaObjetivoSolucion, ahora, 30, ticket.estado)
        : false,
      mensajes: ticket.mensajes.map((mensaje) => ({
        id: mensaje.id,
        canal: mensaje.canal,
        autorTipo: mensaje.autorTipo,
        autor: mensaje.autor?.nombre ?? 'Agente IA',
        contenido: mensaje.contenido,
        fecha: mensaje.fecha,
      })),
    };
  }

  async comentar(actor: Principal, ticketId: string, contenido: string) {
    await this.detalle(actor, ticketId);
    const autorTipo = actor.rol === 'SOLICITANTE' ? 'USUARIO' : actor.rol === 'TECNICO' ? 'TECNICO' : 'USUARIO';
    return this.prisma.mensaje.create({
      data: {
        ticketId,
        autorTipo,
        autorId: actor.id,
        canal: 'WEB',
        contenido: contenido.trim(),
        estadoEntrega: 'ENTREGADO',
      },
      select: { id: true, contenido: true, canal: true, fecha: true },
    });
  }

  async adjuntar(actor: Principal, ticketId: string, archivo: { originalname: string; buffer: Buffer; mimetype: string; size: number }) {
    await this.detalle(actor, ticketId);
    const extension = extname(archivo.originalname).toLowerCase();
    if (!EXTENSIONES.has(extension) || archivo.size <= 0 || archivo.size > MAX_BYTES) {
      throw new HttpException(
        { code: 'validation_error', message: 'El archivo debe ser png, jpg, pdf, txt o webp y pesar hasta 5 MB.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const carpeta = resolve(process.env.UPLOAD_DIR ?? './uploads', ticketId);
    await mkdir(carpeta, { recursive: true });
    const nombre = `${randomUUID()}${extension}`;
    const ruta = join(carpeta, nombre);
    await writeFile(ruta, archivo.buffer);
    return this.prisma.adjunto.create({
      data: {
        ticketId,
        nombre: archivo.originalname.replace(/[^\w.\- ]/g, '_').slice(0, 120),
        ruta,
        mime: archivo.mimetype || 'application/octet-stream',
        tamano: archivo.size,
        subidoPorId: actor.id,
      },
      select: { id: true, nombre: true, tamano: true },
    });
  }

  async descargar(actor: Principal, ticketId: string, adjuntoId: string) {
    await this.detalle(actor, ticketId);
    const adjunto = await this.prisma.adjunto.findFirst({ where: { id: adjuntoId, ticketId } });
    if (!adjunto) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el archivo.' }, HttpStatus.NOT_FOUND);
    }
    const raiz = resolve(process.env.UPLOAD_DIR ?? './uploads');
    const absoluto = resolve(adjunto.ruta);
    if (!absoluto.startsWith(raiz)) {
      throw new HttpException({ code: 'forbidden', message: 'No tienes permiso para esta acción.' }, HttpStatus.FORBIDDEN);
    }
    return new StreamableFile(createReadStream(absoluto), {
      type: adjunto.mime,
      disposition: `attachment; filename="${adjunto.nombre}"`,
    });
  }

  async confirmar(actor: Principal, ticketId: string, entrada: { confirmar: boolean; calificacion?: number }) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, solicitanteId: actor.id },
      include: { historial: { select: { datosNuevos: true } } },
    });
    if (!ticket) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el ticket.' }, HttpStatus.NOT_FOUND);
    }
    const estuvoEnSitio = ticket.historial.some((fila) => JSON.stringify(fila.datosNuevos).includes('EN_SITIO'));
    if (ticket.estado !== 'RESUELTO' || estuvoEnSitio) {
      throw new HttpException(
        { code: 'conflict', message: 'Solo se confirma una solución remota que ya está resuelta.' },
        HttpStatus.CONFLICT,
      );
    }
    const destino = entrada.confirmar ? 'CERRADO' : 'REABIERTO';
    if (entrada.confirmar && (!entrada.calificacion || entrada.calificacion < 1 || entrada.calificacion > 5)) {
      throw new HttpException(
        { code: 'validation_error', message: 'Califica la atención de 1 a 5.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        estado: destino,
        calificacion: entrada.confirmar ? entrada.calificacion : null,
        fechaCierre: entrada.confirmar ? new Date() : null,
      },
    });
    await this.prisma.historial.create({
      data: {
        ticketId: ticket.id,
        usuarioId: actor.id,
        tipo: entrada.confirmar ? 'confirmacion' : 'reapertura',
        datosPrevios: { estado: 'RESUELTO' },
        datosNuevos: { estado: destino, calificacion: entrada.calificacion ?? null },
      },
    });
    return { estado: destino, estadoNombre: ESTADO_TICKET[destino] };
  }

  async revisarPlazos() {
    const ahora = new Date();
    const abiertos = await this.prisma.ticket.findMany({
      where: {
        deletedAt: null,
        estado: { notIn: ['CERRADO', 'CERRADO_CON_ACTA', 'CERRADO_SIN_FIRMA', 'CANCELADO', 'DESCARTADO'] },
        fechaObjetivoSolucion: { not: null },
      },
      select: { id: true, numero: true, estado: true, fechaObjetivoSolucion: true, fechaResolucion: true, responsableId: true, historial: { select: { datosNuevos: true } } },
    });
    let avisos = 0;
    let reabiertos = 0;
    for (const ticket of abiertos) {
      const estuvoEnSitio = ticket.historial.some((fila) => JSON.stringify(fila.datosNuevos).includes('EN_SITIO'));
      if (debeReabrirSinConfirmacion(ticket.estado, estuvoEnSitio, ticket.fechaResolucion, ahora, 24)) {
        await this.prisma.ticket.update({ where: { id: ticket.id }, data: { estado: 'REABIERTO', fechaCierre: null } });
        await this.prisma.historial.create({
          data: {
            ticketId: ticket.id,
            tipo: 'reapertura_plazo',
            datosPrevios: { estado: 'RESUELTO' },
            datosNuevos: { estado: 'REABIERTO' },
          },
        });
        reabiertos += 1;
        continue;
      }
      if (ticket.fechaObjetivoSolucion && estaPorVencer(ticket.fechaObjetivoSolucion, ahora, 30, ticket.estado)) {
        const eventoBase = `por_vencer:${ticket.id}`;
        const destinos = [ticket.responsableId].filter((id): id is string => Boolean(id));
        const admins = await this.prisma.usuario.findMany({
          where: { rol: 'ADMINISTRADOR', activo: true, deletedAt: null },
          select: { id: true },
        });
        for (const usuarioId of [...destinos, ...admins.map((admin) => admin.id)]) {
          const evento = `${eventoBase}:${usuarioId}`;
          const existe = await this.prisma.notificacion.findFirst({ where: { evento } });
          if (!existe) {
            await this.avisos.avisar({
              evento: 'por_vencer',
              usuarios: [usuarioId],
              titulo: `${ticket.numero} está por vencer`,
              cuerpo: 'El tiempo de solución está por cumplirse.',
              clave: () => evento,
            });
            avisos += 1;
          }
        }
      }
    }
    return { avisos, reabiertos };
  }

  async escalar(
    actor: Principal,
    ticketId: string,
    entrada: { nivelDestino: Nivel; motivo: string; acciones: string; responsableId: string },
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, ...(dondeTickets(actor) as Prisma.TicketWhereInput) },
      include: { prioridad: true, solicitante: true },
    });
    if (!ticket) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el ticket.' }, HttpStatus.NOT_FOUND);
    }
    const decision = validarEscalamiento({
      nivelActual: ticket.nivel,
      nivelDestino: entrada.nivelDestino,
      motivo: entrada.motivo,
      acciones: entrada.acciones,
      responsableId: entrada.responsableId,
      areaCompleta: ticket.prioridad?.codigo === 'CRITICA',
    });
    if (!decision.ok) {
      throw new HttpException({ code: 'conflict', message: decision.mensaje }, HttpStatus.CONFLICT);
    }
    const responsable = await this.prisma.usuario.findFirst({
      where: { id: entrada.responsableId, rol: 'TECNICO', activo: true, deletedAt: null, niveles: { some: { nivel: entrada.nivelDestino } } },
    });
    if (!responsable) {
      throw new HttpException(
        { code: 'validation_error', message: 'El responsable debe ser un técnico de ese nivel.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.prisma.escalamiento.create({
      data: {
        ticketId,
        nivelOrigen: ticket.nivel,
        nivelDestino: entrada.nivelDestino,
        motivo: entrada.motivo.trim(),
        acciones: entrada.acciones.trim(),
        usuarioId: actor.id,
      },
    });
    const estado = decision.devolucion ? (entrada.nivelDestino === 'N1' ? 'EN_ATENCION_N1' : 'ASIGNADO') : 'ESCALADO';
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { nivel: entrada.nivelDestino, estado, responsableId: responsable.id },
    });
    await this.prisma.historial.create({
      data: {
        ticketId,
        usuarioId: actor.id,
        tipo: decision.devolucion ? 'devolucion' : 'escalamiento',
        datosPrevios: { nivel: ticket.nivel, estado: ticket.estado },
        datosNuevos: { nivel: entrada.nivelDestino, estado, responsableId: responsable.id },
      },
    });
    await this.avisos.avisar({
      evento: 'cambio_nivel',
      usuarios: [ticket.solicitanteId],
      titulo: `${ticket.numero} cambió de nivel`,
      cuerpo: decision.devolucion
        ? `El caso volvió a ${entrada.nivelDestino}.`
        : `El caso pasó a ${entrada.nivelDestino}.`,
      clave: () => `nivel:${ticketId}:${entrada.nivelDestino}`,
    });
    return { nivel: entrada.nivelDestino, estado, devolucion: decision.devolucion };
  }

  async ruta(actor: Principal, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, ...(dondeTickets(actor) as Prisma.TicketWhereInput) },
      include: {
        escalamientos: { orderBy: { fecha: 'asc' }, include: { usuario: { select: { nombre: true } } } },
        responsable: { select: { nombre: true } },
      },
    });
    if (!ticket) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el ticket.' }, HttpStatus.NOT_FOUND);
    }
    return {
      nivelActual: ticket.nivel,
      responsable: ticket.responsable?.nombre ?? null,
      primeraRespuesta: ticket.fechaObjetivoPrimeraRespuesta,
      solucion: ticket.fechaObjetivoSolucion,
      tramos: ticket.escalamientos.map((tramo) => ({
        desde: tramo.nivelOrigen,
        hacia: tramo.nivelDestino,
        motivo: tramo.motivo,
        acciones: tramo.acciones,
        quien: tramo.usuario.nombre,
        fecha: tramo.fecha,
      })),
    };
  }

  async carga(actor: Principal) {
    const sede = actor.rol === 'ADMINISTRADOR' ? undefined : actor.sedeId;
    const pendientes = await this.prisma.ticket.findMany({
      where: {
        deletedAt: null,
        responsableId: null,
        estado: { in: ['NUEVO', 'ESCALADO', 'REABIERTO'] },
        ...(sede ? { sedeId: sede } : {}),
      },
      select: { id: true, numero: true, titulo: true, nivel: true, estado: true, sede: { select: { nombre: true } } },
      take: 50,
    });
    const tecnicos = await this.prisma.usuario.findMany({
      where: { rol: 'TECNICO', activo: true, deletedAt: null, ...(sede ? { sedeId: sede } : {}) },
      select: {
        id: true,
        nombre: true,
        sede: { select: { nombre: true } },
        niveles: true,
        ticketsAsignados: { where: { deletedAt: null, estado: { notIn: ['CERRADO', 'CANCELADO', 'DESCARTADO'] } }, select: { id: true, nivel: true } },
      },
    });
    return {
      pendientes,
      tecnicos: tecnicos.map((tecnico) => ({
        id: tecnico.id,
        nombre: tecnico.nombre,
        sede: tecnico.sede?.nombre ?? '',
        niveles: tecnico.niveles.map((nivel) => nivel.nivel),
        abiertos: tecnico.ticketsAsignados.length,
      })),
    };
  }

  async asignar(actor: Principal, ticketId: string, responsableId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, ...(dondeTickets(actor) as Prisma.TicketWhereInput) },
    });
    if (!ticket) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el ticket.' }, HttpStatus.NOT_FOUND);
    }
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { responsableId, estado: ticket.estado === 'NUEVO' ? 'ASIGNADO' : ticket.estado === 'ESCALADO' ? 'ASIGNADO' : ticket.estado },
    });
    await this.prisma.historial.create({
      data: {
        ticketId,
        usuarioId: actor.id,
        tipo: 'asignacion',
        datosPrevios: { responsableId: ticket.responsableId },
        datosNuevos: { responsableId },
      },
    });
    return { id: ticketId, responsableId };
  }

  async reabrirDescarte(actor: Principal, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, estado: 'DESCARTADO', ...(dondeTickets(actor) as Prisma.TicketWhereInput) },
    });
    if (!ticket) {
      throw new HttpException({ code: 'not_found', message: 'No hay un descarte con ese número.' }, HttpStatus.NOT_FOUND);
    }
    await this.prisma.ticket.update({ where: { id: ticketId }, data: { estado: 'REABIERTO' } });
    await this.prisma.historial.create({
      data: {
        ticketId,
        usuarioId: actor.id,
        tipo: 'reapertura_descarte',
        datosPrevios: { estado: 'DESCARTADO' },
        datosNuevos: { estado: 'REABIERTO' },
      },
    });
    return { numero: ticket.numero, estado: 'REABIERTO' };
  }
}
