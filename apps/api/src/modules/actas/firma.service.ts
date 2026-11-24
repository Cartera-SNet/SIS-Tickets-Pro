import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpException, HttpStatus, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { codigoSeis, hashToken, tokenOpaco } from '../auth/cripto';
import type { Principal } from '../auth/reglas-acceso';
import { puedeTransicionar, type EstadoTicket } from '../tickets/maquina-estados';
import { AvisosService } from '../notificaciones/avisos.service';
import type { BloquesActa } from './bloques';
import {
  HORAS_ENLACE,
  MAX_INTENTOS_CODIGO,
  MINUTOS_CODIGO,
  codigoVerificacion,
  enlaceSirve,
  evaluarCodigo,
  hashDocumento,
  plazoFirmaVencido,
  recordatoriosDebidos,
} from './firma-reglas';
import { construirPdf } from './pdf-acta';

const DIRECTORIO = join(process.env.STORAGE_DIR ?? join(process.cwd(), 'storage'), 'actas');

type ActaCargada = Prisma.ActaGetPayload<{
  include: {
    firmas: { include: { firmante: { select: { nombre: true } } } };
    ticket: { include: { solicitante: true } };
    orden: { include: { equipo: { include: { responsable: true } } } };
  };
}>;

@Injectable()
export class FirmaService implements OnModuleInit, OnModuleDestroy {
  private reloj: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: AvisosService,
  ) {}

  onModuleInit(): void {
    this.reloj = setInterval(() => {
      void this.recordar().catch(() => undefined);
    }, 60_000);
    this.reloj.unref?.();
  }

  onModuleDestroy(): void {
    if (this.reloj) {
      clearInterval(this.reloj);
    }
  }

  async firmarTecnico(actor: Principal, actaId: string, imagen: string | undefined, peticion: Request) {
    const acta = await this.cargar(actaId);
    if (acta.estado !== 'PENDIENTE_DE_FIRMA') {
      throw new HttpException({ code: 'conflict', message: 'Esta acta ya no admite firma.' }, HttpStatus.CONFLICT);
    }
    if (acta.firmas.some((firma) => firma.rol === 'TECNICO' && firma.resultado === 'FIRMO')) {
      throw new HttpException({ code: 'conflict', message: 'El técnico ya firmó.' }, HttpStatus.CONFLICT);
    }
    if (actor.rol === 'SOLICITANTE') {
      throw new HttpException({ code: 'forbidden', message: 'El técnico firma primero con su sesión.' }, HttpStatus.FORBIDDEN);
    }
    if (acta.ticket && acta.ticket.estado !== 'RESUELTO' && acta.ticket.estado !== 'PENDIENTE_DE_FIRMA') {
      throw new HttpException(
        { code: 'conflict', message: 'Primero marca el caso resuelto en sitio.' },
        HttpStatus.CONFLICT,
      );
    }
    if (acta.ticket && acta.ticket.estado !== 'PENDIENTE_DE_FIRMA') {
      await this.mover(acta.ticket.id, acta.ticket.estado, 'PENDIENTE_DE_FIRMA', {
        estuvoEnSitio: true,
        actaFirmada: false,
        plazoFirmaVencido: false,
        solucionAplicada: acta.ticket.solucionAplicada,
      });
    }
    await this.prisma.firma.create({
      data: {
        actaId,
        firmanteId: actor.id,
        rol: 'TECNICO',
        metodo: 'SESION_WEB',
        imagen: this.imagen(imagen),
        dispositivo: peticion.header('user-agent')?.slice(0, 240) ?? null,
        ip: peticion.ip,
        resultado: 'FIRMO',
      },
    });
    await this.historial(acta, actor.id, 'firma_tecnico', { resultado: 'FIRMO' });
    return { firmadaPor: 'TECNICO' };
  }

  async pedirCodigo(actor: Principal, actaId: string) {
    const acta = await this.exigirTecnico(actaId);
    if (actor.rol === 'SOLICITANTE') {
      throw new HttpException({ code: 'forbidden', message: 'El técnico pide el código desde su sesión.' }, HttpStatus.FORBIDDEN);
    }
    const destino = this.solicitante(acta);
    const codigo = codigoSeis();
    await this.prisma.codigoFirma.create({
      data: {
        usuarioId: destino.id,
        actaId,
        hash: hashToken(codigo),
        expira: new Date(Date.now() + MINUTOS_CODIGO * 60_000),
      },
    });
    await this.avisos.avisar({
      evento: 'codigo_firma',
      usuarios: [destino.id],
      titulo: `Código del acta ${acta.numero}`,
      cuerpo: `Tu código es ${codigo}. Vence en 5 minutos.`,
    });
    return {
      enviado: true,
      codigoPrueba: (process.env.WHATSAPP_MODE ?? 'mock') === 'mock' ? codigo : undefined,
    };
  }

  async firmarSolicitante(actor: Principal, actaId: string, codigo: string, imagen: string | undefined, peticion: Request) {
    const acta = await this.exigirTecnico(actaId);
    if (actor.id === this.solicitante(acta).id) {
      throw new HttpException(
        { code: 'forbidden', message: 'El técnico no puede firmar por el solicitante. El código lo digita la otra persona.' },
        HttpStatus.FORBIDDEN,
      );
    }
    await this.consumirCodigo(actaId, codigo);
    return this.cerrarSegundaFirma(acta, 'DISPOSITIVO_TECNICO', imagen, peticion);
  }

  async rechazarConCodigo(actor: Principal, actaId: string, codigo: string, motivo: string, peticion: Request) {
    const acta = await this.exigirTecnico(actaId);
    if (actor.id === this.solicitante(acta).id) {
      throw new HttpException({ code: 'forbidden', message: 'El técnico no puede rechazar por el solicitante.' }, HttpStatus.FORBIDDEN);
    }
    this.motivo(motivo);
    await this.consumirCodigo(actaId, codigo);
    return this.rechazar(acta, motivo, 'DISPOSITIVO_TECNICO', peticion);
  }

  async crearEnlace(actor: Principal, actaId: string) {
    const acta = await this.exigirTecnico(actaId);
    if (actor.rol === 'SOLICITANTE') {
      throw new HttpException({ code: 'forbidden', message: 'El enlace lo genera el técnico.' }, HttpStatus.FORBIDDEN);
    }
    const destino = this.solicitante(acta);
    const token = tokenOpaco();
    await this.prisma.tokenFirma.create({
      data: {
        actaId,
        firmanteId: destino.id,
        tokenHash: hashToken(token),
        vence: new Date(Date.now() + HORAS_ENLACE * 3_600_000),
      },
    });
    const origen = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
    const url = `${origen}/firmar/${token}`;
    await this.avisos.avisar({
      evento: 'acta_pendiente',
      usuarios: [destino.id],
      titulo: `Firma el acta ${acta.numero}`,
      cuerpo: `plantilla:acta_firma ${url}`,
      clave: () => `enlace:${hashToken(token)}`,
    });
    return { url };
  }

  async verPublico(token: string) {
    const fila = await this.token(token);
    const acta = fila.acta;
    return {
      numero: acta.numero,
      version: acta.version,
      estado: acta.estado,
      contenido: acta.contenido,
      tecnicoFirmo: acta.firmas.some((firma) => firma.rol === 'TECNICO' && firma.resultado === 'FIRMO'),
    };
  }

  async firmarPublico(token: string, imagen: string | undefined, peticion: Request) {
    const fila = await this.token(token);
    if (!fila.acta.firmas.some((firma) => firma.rol === 'TECNICO' && firma.resultado === 'FIRMO')) {
      throw new HttpException({ code: 'conflict', message: 'El técnico firma primero.' }, HttpStatus.CONFLICT);
    }
    await this.prisma.tokenFirma.update({ where: { id: fila.id }, data: { usado: true } });
    return this.cerrarSegundaFirma(fila.acta, 'ENLACE', imagen, peticion);
  }

  async rechazarPublico(token: string, motivo: string, peticion: Request) {
    this.motivo(motivo);
    const fila = await this.token(token);
    await this.prisma.tokenFirma.update({ where: { id: fila.id }, data: { usado: true } });
    return this.rechazar(fila.acta, motivo, 'ENLACE', peticion);
  }

  async verificar(codigo: string) {
    const acta = await this.prisma.acta.findUnique({
      where: { codigoVerificacion: codigo.trim().toUpperCase() },
      include: { firmas: { include: { firmante: { select: { nombre: true } } } } },
    });
    if (!acta?.hash) {
      return { autentico: false };
    }
    const calculado = hashDocumento(
      acta.contenido,
      acta.firmas
        .filter((firma) => firma.resultado === 'FIRMO')
        .map((firma) => ({
          rol: firma.rol,
          metodo: firma.metodo,
          resultado: firma.resultado,
          fecha: firma.fecha.toISOString(),
        })),
    );
    if (calculado !== acta.hash) {
      return { autentico: false };
    }
    return {
      autentico: true,
      codigo: acta.codigoVerificacion,
      hash: acta.hash,
      firmas: acta.firmas
        .filter((firma) => firma.resultado === 'FIRMO')
        .map((firma) => ({
          nombre: firma.firmante.nombre,
          rol: firma.rol,
          metodo: firma.metodo,
          fecha: firma.fecha,
        })),
    };
  }

  async leerPdf(actor: Principal, actaId: string): Promise<Buffer> {
    if (actor.rol === 'SOLICITANTE') {
      const acta = await this.cargar(actaId);
      const propio = acta.ticket?.solicitanteId === actor.id || acta.orden?.equipo.responsableId === actor.id;
      if (!propio) {
        throw new HttpException({ code: 'forbidden', message: 'No tienes permiso para esta acta.' }, HttpStatus.FORBIDDEN);
      }
    }
    const acta = await this.prisma.acta.findUnique({ where: { id: actaId } });
    if (!acta?.pdfRuta) {
      throw new HttpException({ code: 'not_found', message: 'El PDF se genera cuando las dos partes firman.' }, HttpStatus.NOT_FOUND);
    }
    return readFile(acta.pdfRuta);
  }

  async recordar(ahora = new Date()): Promise<{ enviados: number; cerradas: number }> {
    const parametro = await this.prisma.configuracion.findUnique({ where: { clave: 'plazo_cierre_sin_firma_horas' } });
    const horasPlazo = Number(parametro?.valor ?? 48);
    const actas = await this.prisma.acta.findMany({
      where: { estado: 'PENDIENTE_DE_FIRMA' },
      include: {
        firmas: true,
        ticket: { select: { id: true, estado: true, solicitanteId: true, solucionAplicada: true } },
        orden: { include: { equipo: { select: { responsableId: true } } } },
      },
    });
    let enviados = 0;
    let cerradas = 0;
    for (const acta of actas) {
      const tecnico = acta.firmas.find((firma) => firma.rol === 'TECNICO' && firma.resultado === 'FIRMO');
      const destino = acta.ticket?.solicitanteId ?? acta.orden?.equipo.responsableId;
      if (tecnico && destino) {
        const marcas = await this.prisma.historial.findMany({
          where: { tipo: { in: [`recordatorio_firma_4h:${acta.id}`, `recordatorio_firma_24h:${acta.id}`] } },
          select: { tipo: true },
        });
        const debidos = recordatoriosDebidos(tecnico.fecha, ahora, {
          h4: marcas.some((fila) => fila.tipo.startsWith('recordatorio_firma_4h')),
          h24: marcas.some((fila) => fila.tipo.startsWith('recordatorio_firma_24h')),
        });
        for (const marca of debidos) {
          await this.avisos.avisar({
            evento: 'recordatorio_firma',
            usuarios: [destino],
            titulo: `Recordatorio de firma ${marca}`,
            cuerpo: `El acta ${acta.numero} sigue pendiente.`,
            clave: () => `recordatorio_firma_${marca}:${acta.id}:${destino}`,
          });
          await this.prisma.historial.create({
            data: { ticketId: acta.ticketId, ordenId: acta.ordenId, tipo: `recordatorio_firma_${marca}:${acta.id}` },
          });
          enviados += 1;
        }
      }
      const desde = tecnico?.fecha ?? acta.createdAt;
      const segunda = acta.firmas.some((firma) => firma.rol !== 'TECNICO' && firma.resultado === 'FIRMO');
      if (!segunda && plazoFirmaVencido(desde, ahora, horasPlazo)) {
        await this.cerrarSinFirma(acta);
        cerradas += 1;
      }
    }
    return { enviados, cerradas };
  }

  private async cerrarSinFirma(acta: {
    id: string;
    numero: string;
    ticketId: string | null;
    ordenId: string | null;
    ticket: { id: string; estado: string; solucionAplicada: string | null } | null;
  }) {
    const avisos = await this.prisma.notificacion.findMany({
      where: { OR: [{ evento: { contains: acta.id } }, { titulo: { contains: acta.numero } }] },
      take: 20,
      select: { titulo: true, evento: true, entregas: { select: { canal: true, estado: true } } },
    });
    await this.prisma.acta.update({ where: { id: acta.id }, data: { estado: 'CERRADO_SIN_FIRMA' } });
    if (acta.ticket?.estado === 'PENDIENTE_DE_FIRMA') {
      await this.mover(acta.ticket.id, 'PENDIENTE_DE_FIRMA', 'CERRADO_SIN_FIRMA', {
        estuvoEnSitio: true,
        actaFirmada: false,
        plazoFirmaVencido: true,
        solucionAplicada: acta.ticket.solucionAplicada,
      });
    }
    await this.prisma.historial.create({
      data: {
        ticketId: acta.ticketId,
        ordenId: acta.ordenId,
        tipo: 'cierre_sin_firma',
        datosNuevos: { numero: acta.numero, avisos } as Prisma.InputJsonValue,
      },
    });
  }

  private async cerrarSegundaFirma(
    acta: ActaCargada,
    metodo: 'DISPOSITIVO_TECNICO' | 'ENLACE',
    imagen: string | undefined,
    peticion: Request,
  ) {
    if (acta.hash) {
      throw new HttpException(
        { code: 'conflict', message: 'El PDF sellado no se modifica. Una corrección es una versión nueva.' },
        HttpStatus.CONFLICT,
      );
    }
    const destino = this.solicitante(acta);
    await this.prisma.firma.create({
      data: {
        actaId: acta.id,
        firmanteId: destino.id,
        rol: 'SOLICITANTE',
        metodo,
        imagen: this.imagen(imagen),
        numeroVerificado: destino.celularVerificado ? destino.celular : destino.correoNotificaciones,
        dispositivo: peticion.header('user-agent')?.slice(0, 240) ?? null,
        ip: peticion.ip,
        resultado: 'FIRMO',
      },
    });
    const firmas = await this.prisma.firma.findMany({
      where: { actaId: acta.id, resultado: 'FIRMO' },
      include: { firmante: { select: { nombre: true } } },
      orderBy: { fecha: 'asc' },
    });
    const resumen = firmas.map((firma) => ({
      rol: firma.rol,
      metodo: firma.metodo,
      resultado: firma.resultado,
      fecha: firma.fecha.toISOString(),
    }));
    const codigo = codigoVerificacion();
    const hash = hashDocumento(acta.contenido, resumen);
    const origen = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
    const pdf = await construirPdf({
      bloques: acta.contenido as BloquesActa,
      firmas: firmas.map((firma) => ({
        nombre: firma.firmante.nombre,
        rol: firma.rol,
        metodo: firma.metodo,
        fecha: firma.fecha.toISOString(),
      })),
      codigo,
      hash,
      urlVerificacion: `${origen}/verificar?codigo=${codigo}`,
    });
    await mkdir(DIRECTORIO, { recursive: true });
    const ruta = join(DIRECTORIO, `${acta.id}.pdf`);
    await writeFile(ruta, pdf);
    await this.prisma.acta.update({
      where: { id: acta.id },
      data: { estado: 'CERRADO_CON_ACTA', codigoVerificacion: codigo, hash, pdfRuta: ruta },
    });
    if (acta.ticket) {
      await this.mover(acta.ticket.id, 'PENDIENTE_DE_FIRMA', 'CERRADO_CON_ACTA', {
        estuvoEnSitio: true,
        actaFirmada: true,
        plazoFirmaVencido: false,
        solucionAplicada: acta.ticket.solucionAplicada,
      });
      await this.prisma.ticket.update({ where: { id: acta.ticket.id }, data: { fechaCierre: new Date() } });
    }
    await this.historial(acta, destino.id, 'acta_cerrada', { codigo, hash });
    await this.avisos.avisar({
      evento: 'acta_cerrada',
      usuarios: [destino.id, ...acta.firmas.filter((firma) => firma.rol === 'TECNICO').map((firma) => firma.firmanteId)],
      titulo: `Acta ${acta.numero} firmada`,
      cuerpo: `Código de verificación ${codigo}.`,
      clave: (usuarioId) => `acta_cerrada:${acta.id}:${usuarioId}`,
    });
    return { numero: acta.numero, codigo, hash };
  }

  private async rechazar(acta: ActaCargada, motivo: string, metodo: 'DISPOSITIVO_TECNICO' | 'ENLACE', peticion: Request) {
    const destino = this.solicitante(acta);
    await this.prisma.firma.create({
      data: {
        actaId: acta.id,
        firmanteId: destino.id,
        rol: 'SOLICITANTE',
        metodo,
        motivoRechazo: motivo.trim(),
        dispositivo: peticion.header('user-agent')?.slice(0, 240) ?? null,
        ip: peticion.ip,
        resultado: 'RECHAZO',
      },
    });
    await this.prisma.acta.update({ where: { id: acta.id }, data: { estado: 'FIRMA_RECHAZADA' } });
    if (acta.ticket) {
      await this.mover(acta.ticket.id, acta.ticket.estado, 'FIRMA_RECHAZADA', {
        estuvoEnSitio: true,
        actaFirmada: false,
        plazoFirmaVencido: false,
        motivo,
        solucionAplicada: acta.ticket.solucionAplicada,
      });
      await this.mover(acta.ticket.id, 'FIRMA_RECHAZADA', 'EN_SITIO', {
        estuvoEnSitio: true,
        actaFirmada: false,
        plazoFirmaVencido: false,
        solucionAplicada: acta.ticket.solucionAplicada,
      });
    }
    await this.historial(acta, destino.id, 'firma_rechazada', { motivo: motivo.trim() });
    return { estado: 'EN_SITIO', motivo: motivo.trim() };
  }

  private async consumirCodigo(actaId: string, codigo: string) {
    const fila = await this.prisma.codigoFirma.findFirst({ where: { actaId }, orderBy: { expira: 'desc' } });
    if (!fila) {
      throw new HttpException({ code: 'conflict', message: 'Pide primero el código de 6 dígitos.' }, HttpStatus.CONFLICT);
    }
    const decision = evaluarCodigo({
      hashGuardado: fila.hash,
      hashRecibido: hashToken(codigo),
      expira: fila.expira,
      intentos: fila.intentos,
      ahora: new Date(),
    });
    if (decision !== 'ok') {
      if (decision === 'incorrecto') {
        await this.prisma.codigoFirma.update({ where: { id: fila.id }, data: { intentos: { increment: 1 } } });
      }
      const mensaje =
        decision === 'agotado'
          ? 'Se agotaron los intentos del código.'
          : decision === 'vencido'
            ? 'El código venció. Pide otro.'
            : 'El código no coincide.';
      throw new HttpException({ code: 'conflict', message: mensaje }, HttpStatus.CONFLICT);
    }
    await this.prisma.codigoFirma.update({ where: { id: fila.id }, data: { intentos: MAX_INTENTOS_CODIGO } });
  }

  private async exigirTecnico(actaId: string): Promise<ActaCargada> {
    const acta = await this.cargar(actaId);
    if (!acta.firmas.some((firma) => firma.rol === 'TECNICO' && firma.resultado === 'FIRMO')) {
      throw new HttpException({ code: 'conflict', message: 'El técnico firma primero.' }, HttpStatus.CONFLICT);
    }
    if (acta.estado !== 'PENDIENTE_DE_FIRMA') {
      throw new HttpException({ code: 'conflict', message: 'Esta acta ya no admite firma.' }, HttpStatus.CONFLICT);
    }
    return acta;
  }

  private async token(valor: string) {
    const fila = await this.prisma.tokenFirma.findUnique({
      where: { tokenHash: hashToken(valor) },
      include: {
        acta: {
          include: {
            firmas: { include: { firmante: { select: { nombre: true } } } },
            ticket: { include: { solicitante: true } },
            orden: { include: { equipo: { include: { responsable: true } } } },
          },
        },
      },
    });
    if (!fila || !enlaceSirve(fila.vence, fila.usado, new Date())) {
      throw new HttpException({ code: 'not_found', message: 'El enlace ya no sirve.' }, HttpStatus.NOT_FOUND);
    }
    return fila;
  }

  private solicitante(acta: ActaCargada) {
    const persona = acta.ticket?.solicitante ?? acta.orden?.equipo.responsable;
    if (!persona) {
      throw new HttpException({ code: 'conflict', message: 'El acta no tiene segundo firmante.' }, HttpStatus.CONFLICT);
    }
    return persona;
  }

  private async cargar(actaId: string): Promise<ActaCargada> {
    const acta = await this.prisma.acta.findUnique({
      where: { id: actaId },
      include: {
        firmas: { include: { firmante: { select: { nombre: true } } } },
        ticket: { include: { solicitante: true } },
        orden: { include: { equipo: { include: { responsable: true } } } },
      },
    });
    if (!acta) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el acta.' }, HttpStatus.NOT_FOUND);
    }
    return acta;
  }

  private async mover(
    ticketId: string,
    origen: string,
    destino: EstadoTicket,
    contexto: { estuvoEnSitio: boolean; actaFirmada: boolean; plazoFirmaVencido: boolean; solucionAplicada?: string | null; motivo?: string },
  ) {
    const decision = puedeTransicionar(origen as EstadoTicket, destino, contexto);
    if (!decision.ok) {
      throw new HttpException({ code: 'conflict', message: decision.mensaje }, HttpStatus.CONFLICT);
    }
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { estado: destino, fechaCierre: destino === 'CERRADO_CON_ACTA' ? new Date() : undefined },
    });
    await this.prisma.historial.create({
      data: {
        ticketId,
        tipo: 'cambio_estado',
        datosPrevios: { estado: origen },
        datosNuevos: { estado: destino },
      },
    });
  }

  private async historial(acta: { id: string; ticketId: string | null; ordenId: string | null }, usuarioId: string, tipo: string, datos: object) {
    await this.prisma.historial.create({
      data: {
        ticketId: acta.ticketId,
        ordenId: acta.ordenId,
        usuarioId,
        tipo,
        datosNuevos: datos as Prisma.InputJsonValue,
      },
    });
  }

  private motivo(valor: string) {
    if (!valor?.trim() || valor.trim().length < 4) {
      throw new HttpException({ code: 'validation_error', message: 'El rechazo exige un motivo.' }, HttpStatus.BAD_REQUEST);
    }
  }

  private imagen(valor: string | undefined) {
    if (!valor) {
      return null;
    }
    const limpio = valor.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(limpio, 'base64');
    if (buffer.length < 8 || buffer.length > 150_000) {
      throw new HttpException({ code: 'validation_error', message: 'La firma dibujada no es válida.' }, HttpStatus.BAD_REQUEST);
    }
    const copia = new ArrayBuffer(buffer.length);
    new Uint8Array(copia).set(buffer);
    return new Uint8Array(copia) as Uint8Array<ArrayBuffer>;
  }
}
