import { ESTADO_TICKET } from '@sis/shared';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { basename, extname, isAbsolute, resolve, sep } from 'node:path';
import { HttpException, HttpStatus, Injectable, StreamableFile } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dondeTickets, type Principal } from '../auth/reglas-acceso';
import { prioridadPorImpacto, sumarTiempoHabil, type Unidad } from './ans';
import { puedeTransicionar, type EstadoTicket } from './maquina-estados';
import { validarEscalamiento, type Nivel } from './escalamiento';
import { debeCerrarSinConfirmacion, estaPorVencer } from './vigilancia';
import { AvisosService } from '../notificaciones/avisos.service';
import { TiempoRealGateway } from '../notificaciones/tiempo-real.gateway';

const EXTENSIONES = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.txt', '.webp']);
const MAX_BYTES = 5 * 1024 * 1024;
const RUTA_NEON = 'neon';

function raizUploads() {
  return resolve(process.env.UPLOAD_DIR ?? './uploads');
}

function dentroDeUploads(absoluto: string) {
  const raiz = raizUploads();
  const normalizado = resolve(absoluto);
  return normalizado === raiz || normalizado.startsWith(`${raiz}${sep}`);
}

/** Resuelve evidencias antiguas guardadas en disco (antes de Neon). */
function resolverArchivoDisco(rutaGuardada: string, ticketId: string) {
  if (!rutaGuardada || rutaGuardada === RUTA_NEON) {
    return null;
  }
  const raiz = raizUploads();
  const candidatos: string[] = [];
  if (isAbsolute(rutaGuardada)) {
    candidatos.push(resolve(rutaGuardada));
    candidatos.push(resolve(raiz, ticketId, basename(rutaGuardada)));
  } else {
    candidatos.push(resolve(raiz, rutaGuardada));
  }
  for (const candidato of candidatos) {
    const normalizado = resolve(candidato);
    if (!dentroDeUploads(normalizado)) {
      continue;
    }
    if (existsSync(normalizado)) {
      return normalizado;
    }
  }
  return null;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: AvisosService,
    private readonly tiempo: TiempoRealGateway,
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
          responsable: { select: { nombre: true } },
          solicitante: { select: { nombre: true } },
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
        responsableNombre: item.responsable?.nombre ?? null,
        solicitanteNombre: item.solicitante?.nombre ?? null,
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
      subcategoriaIds?: string[];
      observacionCategoria?: string;
      titulo?: string;
      descripcion: string;
      ubicacionId: string;
      equipoId?: string;
      equipoNombre?: string;
      equipoSerial?: string;
      puedeTrabajar?: boolean;
      personas?: number;
      areaCompleta?: boolean;
    },
  ) {
    const puedeTrabajar = entrada.puedeTrabajar ?? true;
    const personas = entrada.personas ?? 1;
    const areaCompleta = entrada.areaCompleta ?? false;
    const codigo = prioridadPorImpacto({ puedeTrabajar, personas, areaCompleta });
    const idsElegidos = [
      ...new Set(
        [...(entrada.subcategoriaIds ?? []), entrada.subcategoriaId].filter((id): id is string => Boolean(id)),
      ),
    ];
    const tipos = idsElegidos.length
      ? await this.prisma.subcategoria.findMany({
          where: { id: { in: idsElegidos }, categoriaId: entrada.categoriaId, deletedAt: null, activo: true },
          select: { id: true, nombre: true },
        })
      : [];
    const observacion = entrada.observacionCategoria?.trim() ?? '';
    const eligioOtros = tipos.some((item) => item.nombre.toLowerCase() === 'otros') || (!tipos.length && observacion);
    if (eligioOtros && observacion.length < 4) {
      throw new HttpException(
        { code: 'validation_error', message: 'Si eliges Otros, escribe una observación de al menos 4 caracteres.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!tipos.length && !observacion && !entrada.titulo?.trim()) {
      throw new HttpException(
        { code: 'validation_error', message: 'Elige al menos un tipo de incidencia o solicitud.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const nombresTipo = tipos.map((item) => item.nombre);
    if (observacion && !nombresTipo.some((nombre) => nombre.toLowerCase() === 'otros')) {
      nombresTipo.push(`Otros: ${observacion}`);
    } else if (observacion) {
      const indice = nombresTipo.findIndex((nombre) => nombre.toLowerCase() === 'otros');
      if (indice >= 0) {
        nombresTipo[indice] = `Otros: ${observacion}`;
      }
    }
    const subcategoriaId = tipos.find((item) => item.nombre.toLowerCase() !== 'otros')?.id ?? tipos[0]?.id ?? null;
    const descripcionBase = entrada.descripcion.trim();
    const descripcion =
      nombresTipo.length > 0
        ? `Tipos: ${nombresTipo.join(' · ')}\n\n${descripcionBase}`
        : descripcionBase;
    const titulo =
      entrada.titulo?.trim() ||
      (nombresTipo[0] ? nombresTipo[0].slice(0, 120) : descripcionBase.slice(0, 80)) ||
      'Solicitud de mesa de ayuda';

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
          subcategoriaId,
          titulo,
          descripcion,
          sedeId: ubicacion.sedeId,
          ubicacionId: ubicacion.id,
          equipoId: entrada.equipoId || null,
          equipoNombre: entrada.equipoNombre?.trim() || null,
          equipoSerial: entrada.equipoSerial?.trim() || null,
          impactoPuedeTrabajar: puedeTrabajar,
          impactoPersonas: personas,
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
          datosNuevos: {
            numero: ticket.numero,
            estado: 'NUEVO',
            prioridad: codigo,
            tipos: nombresTipo,
            observacionCategoria: observacion || null,
          },
        },
      });
      return {
        id: ticket.id,
        numero: ticket.numero,
        titulo: ticket.titulo,
        estado: ticket.estado,
        estadoNombre: ESTADO_TICKET.NUEVO,
        nivel: ticket.nivel,
        canal: ticket.canalOrigen,
        sedeId: ticket.sedeId,
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

    const payloadBandeja = {
      id: creado.id,
      numero: creado.numero,
      titulo: creado.titulo,
      estado: creado.estado,
      estadoNombre: creado.estadoNombre,
      nivel: creado.nivel,
      canal: creado.canal,
      categoria: '',
      responsableNombre: null,
      fechaObjetivoSolucion: null,
      ticketId: creado.id,
    };
    this.tiempo.emitirMesa('ticket:creado', payloadBandeja);
    if (creado.sedeId) {
      this.tiempo.emitirSede(creado.sedeId, 'ticket:creado', payloadBandeja);
    }
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
    const payload = {
      id: actualizado.id,
      numero: actualizado.numero,
      estado: actualizado.estado,
      estadoNombre: ESTADO_TICKET[destino],
      ticketId: ticket.id,
    };
    this.tiempo.emitirTicket(ticket.id, 'ticket:estado', payload);
    if (destino === 'RESUELTO') {
      await this.avisos
        .avisar({
          evento: 'ticket_resuelto',
          usuarios: [ticket.solicitanteId],
          titulo: `${ticket.numero} quedó solucionado`,
          cuerpo: 'Confirma si tu solicitud ya está resuelta.',
          clave: () => `resuelto:${ticket.id}:${Date.now()}`,
        })
        .catch(() => undefined);
      this.tiempo.emitir(ticket.solicitanteId, 'ticket:resuelto', payload);
    }
    return payload;
  }

  async listarAdjuntos(actor: Principal, ticketId: string) {
    try {
      await this.detalle(actor, ticketId);
      const filas = await this.prisma.adjunto.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, nombre: true, tamano: true, mime: true, subidoPorId: true, createdAt: true },
      });
      return { items: filas };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      return { items: [] };
    }
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
        mensajes: {
          orderBy: { fecha: 'asc' },
          include: {
            autor: { select: { nombre: true } },
            adjunto: { select: { id: true, nombre: true, mime: true, tamano: true } },
          },
        },
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
        adjuntoId: mensaje.adjuntoId,
        adjunto: mensaje.adjunto
          ? {
              id: mensaje.adjunto.id,
              nombre: mensaje.adjunto.nombre,
              mime: mensaje.adjunto.mime,
              tamano: mensaje.adjunto.tamano,
            }
          : null,
      })),
      adjuntos: ticket.adjuntos.map((adjunto) => ({
        id: adjunto.id,
        nombre: adjunto.nombre,
        tamano: adjunto.tamano,
        mime: adjunto.mime,
        subidoPorId: adjunto.subidoPorId,
      })),
      equipoNombre: ticket.equipoNombre ?? ticket.equipo?.tipo ?? null,
      equipoSerial: ticket.equipoSerial ?? ticket.equipo?.serial ?? null,
      canal: ticket.canalOrigen,
    };
  }

  async comentar(actor: Principal, ticketId: string, contenido: string) {
    const ticket = await this.detalle(actor, ticketId);
    const autorTipo =
      actor.rol === 'SOLICITANTE' ? 'USUARIO' : actor.rol === 'TECNICO' ? 'TECNICO' : actor.rol === 'ADMINISTRADOR' ? 'TECNICO' : 'USUARIO';
    const mensaje = await this.prisma.mensaje.create({
      data: {
        ticketId,
        autorTipo,
        autorId: actor.id,
        canal: 'WEB',
        contenido: contenido.trim(),
        estadoEntrega: 'ENTREGADO',
      },
      include: { autor: { select: { nombre: true } }, adjunto: { select: { id: true, nombre: true, mime: true, tamano: true } } },
    });
    const payload = {
      id: mensaje.id,
      canal: mensaje.canal,
      autorTipo: mensaje.autorTipo,
      autor: mensaje.autor?.nombre ?? 'Usuario',
      contenido: mensaje.contenido,
      fecha: mensaje.fecha,
      ticketId,
      adjuntoId: mensaje.adjuntoId,
      adjunto: mensaje.adjunto,
    };
    this.tiempo.emitirTicket(ticketId, 'ticket:mensaje', payload);
    const destinos = new Set<string>();
    if (ticket.solicitante?.id && ticket.solicitante.id !== actor.id) {
      destinos.add(ticket.solicitante.id);
    }
    const responsableId = (ticket as { responsable?: { id?: string } | null }).responsable?.id;
    if (responsableId && responsableId !== actor.id) {
      destinos.add(responsableId);
    }
    for (const usuarioId of destinos) {
      this.tiempo.emitir(usuarioId, 'ticket:mensaje', payload);
    }
    return payload;
  }

  private validarPermisoAdjunto(ticket: { solicitante: { id: string } }, actor: Principal) {
    const esSolicitante = ticket.solicitante.id === actor.id;
    const esEquipo = actor.rol === 'TECNICO' || actor.rol === 'ADMINISTRADOR';
    if (esSolicitante || esEquipo) {
      return { esSolicitante, esEquipo };
    }
    throw new HttpException(
      { code: 'forbidden', message: 'No puedes adjuntar evidencias en este caso.' },
      HttpStatus.FORBIDDEN,
    );
  }

  private bytesDesdeBase64(base64Crudo: string) {
    const limpio = base64Crudo.replace(/^data:[^;]+;base64,/i, '').replace(/\s/g, '');
    if (!limpio) {
      throw new HttpException(
        { code: 'validation_error', message: 'El base64 de la evidencia está vacío.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(limpio, 'base64');
    } catch {
      throw new HttpException(
        { code: 'validation_error', message: 'El base64 de la evidencia no es válido.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!buffer.length) {
      throw new HttpException(
        { code: 'validation_error', message: 'No se pudo decodificar el base64 de la evidencia.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return buffer;
  }

  private async guardarAdjuntoNeon(
    actor: Principal,
    ticketId: string,
    archivo: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    opciones: { mensajeRespuesta?: string } = {},
  ) {
    const ticket = await this.detalle(actor, ticketId);
    const extension = extname(archivo.originalname).toLowerCase();
    if (!EXTENSIONES.has(extension) || archivo.size <= 0 || archivo.size > MAX_BYTES) {
      throw new HttpException(
        { code: 'validation_error', message: 'El archivo debe ser png, jpg, pdf, txt o webp y pesar hasta 5 MB.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!archivo.buffer?.length) {
      throw new HttpException(
        { code: 'validation_error', message: 'No se recibió el contenido del archivo.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const respuesta = opciones.mensajeRespuesta?.trim() ?? '';
    const { esEquipo, esSolicitante } = this.validarPermisoAdjunto(ticket, actor);

    const hash = createHash('sha256').update(archivo.buffer).digest('hex');
    // Copia a ArrayBuffer propio para Prisma Bytes (evita SharedArrayBuffer en tsc).
    const copiaContenido = new ArrayBuffer(archivo.buffer.length);
    const contenidoBytes = new Uint8Array(copiaContenido);
    contenidoBytes.set(archivo.buffer);

    const nombreLimpio = archivo.originalname.replace(/[^\w.\- ]/g, '_').slice(0, 120);
    const adjunto = await this.prisma.adjunto.create({
      data: {
        ticketId,
        nombre: nombreLimpio,
        ruta: RUTA_NEON,
        mime: archivo.mimetype || 'application/octet-stream',
        tamano: archivo.size,
        hash,
        contenido: contenidoBytes,
        subidoPorId: actor.id,
      },
      select: { id: true, nombre: true, tamano: true, mime: true, subidoPorId: true },
    });

    // Chat estilo WhatsApp: la evidencia viaja siempre como mensaje (con o sin texto).
    const contenido = respuesta || `📎 ${adjunto.nombre}`;
    const autorTipo = esEquipo ? 'TECNICO' : 'USUARIO';
    const mensaje = await this.prisma.mensaje.create({
      data: {
        ticketId,
        autorTipo,
        autorId: actor.id,
        canal: 'WEB',
        contenido,
        adjuntoId: adjunto.id,
        estadoEntrega: 'ENTREGADO',
      },
      include: { autor: { select: { nombre: true } } },
    });
    const mensajePayload = {
      id: mensaje.id,
      canal: mensaje.canal,
      autorTipo: mensaje.autorTipo,
      autor: mensaje.autor?.nombre ?? 'Usuario',
      contenido: mensaje.contenido,
      fecha: mensaje.fecha,
      ticketId,
      adjuntoId: adjunto.id,
      adjunto: {
        id: adjunto.id,
        nombre: adjunto.nombre,
        mime: adjunto.mime ?? 'application/octet-stream',
        tamano: adjunto.tamano,
      },
    };
    this.tiempo.emitirTicket(ticketId, 'ticket:mensaje', mensajePayload);
    const destinos = new Set<string>();
    if (ticket.solicitante?.id && ticket.solicitante.id !== actor.id) {
      destinos.add(ticket.solicitante.id);
    }
    const responsableId = (ticket as { responsable?: { id?: string } | null }).responsable?.id;
    if (responsableId && responsableId !== actor.id) {
      destinos.add(responsableId);
    }
    for (const usuarioId of destinos) {
      this.tiempo.emitir(usuarioId, 'ticket:mensaje', mensajePayload);
    }

    this.tiempo.emitirTicket(ticketId, 'ticket:adjunto', { ...adjunto, ticketId, accion: 'agregado' });
    return { ...adjunto, mensaje: mensajePayload, enviadoEnChat: esEquipo || esSolicitante };
  }

  async adjuntar(
    actor: Principal,
    ticketId: string,
    archivo: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    opciones: { mensajeRespuesta?: string } = {},
  ) {
    return this.guardarAdjuntoNeon(actor, ticketId, archivo, opciones);
  }

  /** Recibe evidencia en base64 (petición JSON) y la guarda como BYTEA en Neon. */
  async adjuntarBase64(
    actor: Principal,
    ticketId: string,
    entrada: { nombre: string; mime: string; base64: string },
    opciones: { mensajeRespuesta?: string } = {},
  ) {
    const buffer = this.bytesDesdeBase64(entrada.base64);
    return this.guardarAdjuntoNeon(
      actor,
      ticketId,
      {
        originalname: entrada.nombre || 'evidencia.bin',
        buffer,
        mimetype: entrada.mime || 'application/octet-stream',
        size: buffer.length,
      },
      opciones,
    );
  }

  private async leerContenidoAdjunto(ticketId: string, adjuntoId: string) {
    const adjunto = await this.prisma.adjunto.findFirst({
      where: { id: adjuntoId, ticketId },
      select: { id: true, nombre: true, mime: true, tamano: true, ruta: true, contenido: true },
    });
    if (!adjunto) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el archivo.' }, HttpStatus.NOT_FOUND);
    }
    if (adjunto.contenido && adjunto.contenido.length > 0) {
      const bytes = Buffer.alloc(adjunto.contenido.length);
      bytes.set(adjunto.contenido);
      return { adjunto, bytes };
    }
    const absoluto = resolverArchivoDisco(adjunto.ruta, ticketId);
    if (absoluto) {
      const bytes = await readFile(absoluto);
      return { adjunto, bytes };
    }
    throw new HttpException(
      {
        code: 'not_found',
        message:
          'Esta evidencia no tiene contenido en Neon. Vuelve a subirla; el visor usa base64 consultado desde la base.',
      },
      HttpStatus.NOT_FOUND,
    );
  }

  /** Devuelve la evidencia desde Neon convertida a base64 para el cliente. */
  async descargarBase64(actor: Principal, ticketId: string, adjuntoId: string) {
    await this.detalle(actor, ticketId);
    const { adjunto, bytes } = await this.leerContenidoAdjunto(ticketId, adjuntoId);
    return {
      id: adjunto.id,
      nombre: adjunto.nombre,
      mime: adjunto.mime || 'application/octet-stream',
      tamano: adjunto.tamano,
      base64: bytes.toString('base64'),
    };
  }

  async descargar(actor: Principal, ticketId: string, adjuntoId: string, inline = false) {
    await this.detalle(actor, ticketId);
    const { adjunto, bytes } = await this.leerContenidoAdjunto(ticketId, adjuntoId);
    const modo = inline ? 'inline' : 'attachment';
    return new StreamableFile(bytes, {
      type: adjunto.mime,
      disposition: `${modo}; filename="${adjunto.nombre}"`,
    });
  }

  async quitarAdjunto(actor: Principal, ticketId: string, adjuntoId: string) {
    const ticket = await this.detalle(actor, ticketId);
    const adjunto = await this.prisma.adjunto.findFirst({ where: { id: adjuntoId, ticketId } });
    if (!adjunto) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el archivo.' }, HttpStatus.NOT_FOUND);
    }
    const esDueno = adjunto.subidoPorId === actor.id || ticket.solicitante.id === actor.id;
    const esEquipo = actor.rol === 'TECNICO' || actor.rol === 'ADMINISTRADOR';
    if (!esDueno && !esEquipo) {
      throw new HttpException({ code: 'forbidden', message: 'No puedes eliminar esta evidencia.' }, HttpStatus.FORBIDDEN);
    }
    const absoluto = resolverArchivoDisco(adjunto.ruta, ticketId);
    if (absoluto) {
      await unlink(absoluto).catch(() => undefined);
    }
    await this.prisma.mensaje.updateMany({ where: { adjuntoId: adjunto.id }, data: { adjuntoId: null } });
    await this.prisma.adjunto.delete({ where: { id: adjunto.id } });
    this.tiempo.emitirTicket(ticketId, 'ticket:adjunto', { id: adjunto.id, ticketId, accion: 'eliminado' });
    return { ok: true, id: adjunto.id };
  }

  async confirmar(
    actor: Principal,
    ticketId: string,
    entrada: { confirmar: boolean; calificacion?: number; comentario?: string },
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, solicitanteId: actor.id },
    });
    if (!ticket) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el ticket.' }, HttpStatus.NOT_FOUND);
    }
    if (ticket.estado !== 'RESUELTO') {
      throw new HttpException(
        { code: 'conflict', message: 'Solo se confirma cuando el técnico ya marcó la solución.' },
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
    if (!entrada.confirmar && !(entrada.comentario?.trim())) {
      throw new HttpException(
        { code: 'validation_error', message: 'Indica por qué la solicitud aún no está solucionada.' },
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
        datosNuevos: {
          estado: destino,
          calificacion: entrada.calificacion ?? null,
          comentario: entrada.comentario?.trim() || null,
        },
      },
    });
    if (!entrada.confirmar && entrada.comentario?.trim()) {
      await this.comentar(actor, ticketId, entrada.comentario.trim()).catch(() => undefined);
    }
    const afectados = [ticket.responsableId, ticket.solicitanteId].filter((id): id is string => Boolean(id));
    for (const usuarioId of afectados) {
      this.tiempo.emitir(usuarioId, 'ticket:estado', {
        ticketId: ticket.id,
        estado: destino,
        estadoNombre: ESTADO_TICKET[destino as keyof typeof ESTADO_TICKET],
      });
    }
    this.tiempo.emitirTicket(ticket.id, 'ticket:estado', {
      ticketId: ticket.id,
      estado: destino,
      estadoNombre: ESTADO_TICKET[destino as keyof typeof ESTADO_TICKET],
    });
    return { estado: destino, estadoNombre: ESTADO_TICKET[destino as keyof typeof ESTADO_TICKET] };
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
      if (debeCerrarSinConfirmacion(ticket.estado, ticket.fechaResolucion, ahora, 24)) {
        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { estado: 'CERRADO', fechaCierre: ahora },
        });
        await this.prisma.historial.create({
          data: {
            ticketId: ticket.id,
            tipo: 'cierre_automatico',
            datosPrevios: { estado: 'RESUELTO' },
            datosNuevos: { estado: 'CERRADO', motivo: 'Sin confirmación del solicitante en 24 h' },
          },
        });
        this.tiempo.emitirTicket(ticket.id, 'ticket:estado', {
          ticketId: ticket.id,
          estado: 'CERRADO',
          estadoNombre: ESTADO_TICKET.CERRADO,
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
      where: {
        id: entrada.responsableId,
        activo: true,
        deletedAt: null,
        OR: [
          { rol: 'TECNICO', niveles: { some: { nivel: entrada.nivelDestino } } },
          { rol: 'ADMINISTRADOR' },
        ],
      },
    });
    if (!responsable) {
      throw new HttpException(
        { code: 'validation_error', message: 'Asigna un técnico de ese nivel o un administrador.' },
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
    const estado = 'ASIGNADO';
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { nivel: entrada.nivelDestino, estado, responsableId: responsable.id },
    });
    await this.prisma.historial.create({
      data: {
        ticketId,
        usuarioId: actor.id,
        tipo: 'escalamiento',
        datosPrevios: { nivel: ticket.nivel, estado: ticket.estado, responsableId: ticket.responsableId },
        datosNuevos: {
          nivel: entrada.nivelDestino,
          estado,
          responsableId: responsable.id,
          responsableNombre: responsable.nombre,
          asignadoPorId: actor.id,
          motivo: entrada.motivo.trim(),
          acciones: entrada.acciones.trim(),
        },
      },
    });
    await this.avisos.avisar({
      evento: 'cambio_nivel',
      usuarios: [ticket.solicitanteId, responsable.id],
      titulo: `${ticket.numero} escaló a ${entrada.nivelDestino}`,
      cuerpo: `Quedó asignado a ${responsable.nombre}.`,
      clave: () => `nivel:${ticketId}:${entrada.nivelDestino}:${Date.now()}`,
    });
    this.tiempo.emitir(responsable.id, 'ticket:asignado', {
      ticketId,
      numero: ticket.numero,
      nivel: entrada.nivelDestino,
      responsableId: responsable.id,
    });
    this.tiempo.emitirTicket(ticketId, 'ticket:estado', {
      ticketId,
      estado,
      nivel: entrada.nivelDestino,
      responsableId: responsable.id,
    });
    return { nivel: entrada.nivelDestino, estado, devolucion: false, responsableId: responsable.id };
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
      where: {
        activo: true,
        deletedAt: null,
        OR: [{ rol: 'TECNICO', ...(sede ? { sedeId: sede } : {}) }, { rol: 'ADMINISTRADOR' }],
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        sede: { select: { nombre: true } },
        niveles: true,
        ticketsAsignados: { where: { deletedAt: null, estado: { notIn: ['CERRADO', 'CANCELADO', 'DESCARTADO'] } }, select: { id: true, nivel: true } },
      },
    });
    return {
      pendientes,
      tecnicos: tecnicos.map((tecnico) => ({
        id: tecnico.id,
        nombre: tecnico.rol === 'ADMINISTRADOR' ? `${tecnico.nombre} (Admin)` : tecnico.nombre,
        sede: tecnico.sede?.nombre ?? '',
        niveles: tecnico.rol === 'ADMINISTRADOR' ? ['N1', 'N2', 'N3'] : tecnico.niveles.map((nivel) => nivel.nivel),
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
    const responsable = await this.prisma.usuario.findFirst({
      where: {
        id: responsableId,
        activo: true,
        deletedAt: null,
        OR: [{ rol: 'TECNICO' }, { rol: 'ADMINISTRADOR' }],
      },
      select: { id: true, nombre: true },
    });
    if (!responsable) {
      throw new HttpException(
        { code: 'validation_error', message: 'El responsable debe ser un técnico o administrador activo.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const estado =
      ticket.estado === 'NUEVO' || ticket.estado === 'ESCALADO' || ticket.estado === 'REABIERTO' ? 'ASIGNADO' : ticket.estado;
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { responsableId, estado },
    });
    await this.prisma.historial.create({
      data: {
        ticketId,
        usuarioId: actor.id,
        tipo: 'asignacion',
        datosPrevios: { responsableId: ticket.responsableId, estado: ticket.estado },
        datosNuevos: {
          responsableId,
          responsableNombre: responsable.nombre,
          asignadoPorId: actor.id,
          estado,
          fecha: new Date().toISOString(),
        },
      },
    });
    await this.avisos
      .avisar({
        evento: 'ticket_asignado',
        usuarios: [responsable.id, ticket.solicitanteId],
        titulo: `${ticket.numero} asignado`,
        cuerpo: `Responsable: ${responsable.nombre}.`,
        clave: () => `asignado:${ticketId}:${responsable.id}:${Date.now()}`,
      })
      .catch(() => undefined);
    this.tiempo.emitir(responsable.id, 'ticket:asignado', { ticketId, numero: ticket.numero, responsableId });
    this.tiempo.emitirTicket(ticketId, 'ticket:estado', { ticketId, estado, responsableId });
    return { id: ticketId, responsableId, estado };
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
