import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { clasificarConfianza, decidirTurno, textoSinSecretos } from './agente-turno';

@Injectable()
export class AgenteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tickets: TicketsService,
  ) {}

  async atender(usuarioId: string, textoOriginal: string, esImagen: boolean): Promise<string> {
    const texto = textoSinSecretos(textoOriginal);
    const [umbralFila, intentosFila, redireccion] = await Promise.all([
      this.prisma.configuracion.findUnique({ where: { clave: 'umbral_confianza_agente' } }),
      this.prisma.configuracion.findUnique({ where: { clave: 'max_intentos_guiados' } }),
      this.prisma.configuracion.findUnique({ where: { clave: 'canal_redireccion_software' } }),
    ]);
    const umbral = Number(umbralFila?.valor ?? 0.7);
    const maxIntentos = Number(intentosFila?.valor ?? 2);
    const confianza = clasificarConfianza(texto);
    const articulo = esImagen ? null : await this.buscarPublicado(texto);
    const intentosGuia = await this.contarGuias(usuarioId);
    const yaEscalado = await this.tieneEscalado(usuarioId);
    const decision = decidirTurno({
      texto,
      esImagen,
      confianza,
      umbral,
      intentosGuia,
      maxIntentos,
      hayArticulo: Boolean(articulo),
      yaEscalado,
    });
    const respuesta = await this.ejecutar(usuarioId, texto, decision, articulo, redireccion?.valor);
    await this.prisma.conversacionIa.create({
      data: {
        usuarioId,
        decisiones: [{ tipo: decision.tipo, confianza, articulo: articulo?.codigo ?? null }],
        confianza,
        articuloId: articulo?.id,
        transferencia: decision.tipo === 'baja_confianza',
      },
    });
    return respuesta;
  }

  private async ejecutar(
    usuarioId: string,
    texto: string,
    decision: ReturnType<typeof decidirTurno>,
    articulo: { id: string; codigo: string; titulo: string; pasos: string } | null,
    redireccion?: string,
  ): Promise<string> {
    if (decision.tipo === 'privacidad') {
      return 'Puede haber datos de un paciente. No los proceso ni los envío al modelo. Cuéntame solo el problema del equipo, sin nombres ni documentos clínicos.';
    }
    if (decision.tipo === 'credencial') {
      return 'No envíes contraseñas ni códigos. No los guardo. Pide el desbloqueo a la mesa sin escribir la clave.';
    }
    if (decision.tipo === 'software') {
      const mensaje = redireccion ?? 'Envía tu solicitud al área responsable de desarrollo de software';
      await this.descartar(usuarioId, texto, mensaje);
      return `Esto es un cambio de software, no un soporte de equipo. ${mensaje}`;
    }
    if (decision.tipo === 'consultar_estado') {
      const propios = await this.prisma.ticket.findMany({
        where: { solicitanteId: usuarioId, deletedAt: null },
        orderBy: { fechaCreacion: 'desc' },
        take: 5,
        select: { numero: true, estado: true },
      });
      if (propios.length === 0) {
        return 'No tienes casos abiertos a tu nombre.';
      }
      return propios.map((ticket) => `${ticket.numero}: ${ticket.estado}`).join('. ');
    }
    if (decision.tipo === 'baja_confianza') {
      return 'No estoy seguro de cómo clasificarlo. Lo dejo con un analista.';
    }
    if (decision.tipo === 'guiar' && articulo) {
      await this.prisma.baseConocimiento.update({ where: { id: articulo.id }, data: { usos: { increment: 1 } } });
      return `${articulo.codigo}. ${articulo.titulo}. ${articulo.pasos} Si ya quedó, respóndeme «ya quedó».`;
    }
    if (decision.tipo === 'resuelto_n1') {
      return 'Quedó registrado como resuelto en N1. Confirma por la web y califica de 1 a 5. No cierro casos que ya fueron escalados.';
    }
    const numero = await this.crearDelUsuario(usuarioId, texto);
    return numero
      ? `Abrí el caso ${numero}. Un técnico continúa la atención.`
      : 'Para abrir el caso dime la sede y el puesto, por ejemplo «sede norte puesto 12».';
  }

  private async buscarPublicado(texto: string) {
    const palabra = texto.split(/\s+/).find((parte) => parte.length > 4) ?? texto;
    return this.prisma.baseConocimiento.findFirst({
      where: {
        estado: 'PUBLICADO',
        deletedAt: null,
        OR: [
          { titulo: { contains: palabra, mode: 'insensitive' } },
          { pasos: { contains: palabra, mode: 'insensitive' } },
        ],
      },
      select: { id: true, codigo: true, titulo: true, pasos: true },
    });
  }

  private async contarGuias(usuarioId: string): Promise<number> {
    const desde = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const filas = await this.prisma.conversacionIa.findMany({
      where: { usuarioId, fecha: { gte: desde } },
      select: { decisiones: true },
    });
    return filas.filter((fila) => JSON.stringify(fila.decisiones).includes('guiar')).length;
  }

  private async tieneEscalado(usuarioId: string): Promise<boolean> {
    const escalado = await this.prisma.escalamiento.findFirst({
      where: { ticket: { solicitanteId: usuarioId, deletedAt: null, estado: { notIn: ['CERRADO', 'CANCELADO', 'DESCARTADO'] } } },
    });
    return Boolean(escalado);
  }

  private async descartar(usuarioId: string, texto: string, mensaje: string) {
    const ubicacion = await this.ubicacionDe(usuarioId, texto);
    if (!ubicacion) {
      return;
    }
    const categoria = await this.prisma.categoria.findFirst({ where: { deletedAt: null }, select: { id: true } });
    if (!categoria) {
      return;
    }
    const creado = await this.tickets.crear(usuarioId, {
      categoriaId: categoria.id,
      titulo: texto.slice(0, 120),
      descripcion: texto,
      ubicacionId: ubicacion.id,
      puedeTrabajar: true,
      personas: 1,
      areaCompleta: false,
    });
    await this.prisma.ticket.update({
      where: { id: creado.id },
      data: { estado: 'DESCARTADO', motivoDescarte: 'Requiere desarrollo de software', reglaDescarte: 'frontera-software', mensajeRedireccion: mensaje },
    });
  }

  private async crearDelUsuario(usuarioId: string, texto: string): Promise<string | null> {
    const ubicacion = await this.ubicacionDe(usuarioId, texto);
    const categoria = await this.categoriaDe(texto);
    if (!ubicacion || !categoria) {
      return null;
    }
    const creado = await this.tickets.crear(usuarioId, {
      categoriaId: categoria,
      titulo: texto.slice(0, 120),
      descripcion: texto,
      ubicacionId: ubicacion.id,
      puedeTrabajar: false,
      personas: 1,
      areaCompleta: false,
    });
    return creado.numero;
  }

  private async ubicacionDe(usuarioId: string, texto: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { ubicacionHabitualId: true } });
    const coincidencia = await this.prisma.ubicacion.findFirst({
      where: { deletedAt: null, nombre: { contains: 'puesto', mode: 'insensitive' } },
    });
    if (/puesto|sede/i.test(texto) && coincidencia) {
      return coincidencia;
    }
    if (usuario?.ubicacionHabitualId) {
      return this.prisma.ubicacion.findUnique({ where: { id: usuario.ubicacionHabitualId } });
    }
    return null;
  }

  private async categoriaDe(texto: string): Promise<string | null> {
    const nombre = /\b(internet|wifi|vpn|red)\b/i.test(texto)
      ? 'Redes'
      : /\b(impresora|tóner|toner|escáner|escaner)\b/i.test(texto)
        ? 'Impresión'
        : /\b(correo|usuario|carpeta)\b/i.test(texto)
          ? 'Cuentas'
          : /\b(word|excel|pdf|navegador)\b/i.test(texto)
            ? 'Ofimática'
            : 'Hardware';
    const categoria = await this.prisma.categoria.findFirst({ where: { nombre, deletedAt: null }, select: { id: true } });
    return categoria?.id ?? null;
  }
}
