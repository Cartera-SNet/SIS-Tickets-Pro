import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { Principal } from '../auth/reglas-acceso';
import { ActasService } from '../actas/actas.module';
import { AvisosService } from '../notificaciones/avisos.service';
import {
  dentroDeAnticipacion,
  faltanObligatorios,
  cumplimiento,
  sumarFrecuencia,
  type Frecuencia,
  type ItemChecklist,
  type ResultadoItem,
} from './preventivo-reglas';

type PlanGuardado = { items: ItemChecklist[]; areaIds: string[]; equipoIds: string[] };

function leerPlan(valor: unknown): PlanGuardado {
  if (Array.isArray(valor)) {
    return { items: valor as ItemChecklist[], areaIds: [], equipoIds: [] };
  }
  const cuerpo = valor as PlanGuardado;
  return {
    items: Array.isArray(cuerpo?.items) ? cuerpo.items : [],
    areaIds: Array.isArray(cuerpo?.areaIds) ? cuerpo.areaIds : [],
    equipoIds: Array.isArray(cuerpo?.equipoIds) ? cuerpo.equipoIds : [],
  };
}

@Injectable()
export class PreventivoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actas: ActasService,
    private readonly avisos: AvisosService,
  ) {}

  equipos() {
    return this.prisma.equipo.findMany({
      where: { deletedAt: null },
      orderBy: { placa: 'asc' },
      take: 100,
      select: {
        id: true,
        placa: true,
        serial: true,
        tipo: true,
        marca: true,
        modelo: true,
        estado: true,
        sede: { select: { id: true, nombre: true } },
        area: { select: { id: true, nombre: true } },
        ubicacion: { select: { nombre: true } },
        responsable: { select: { id: true, nombre: true } },
      },
    });
  }

  async crearEquipo(entrada: {
    placa?: string;
    serial?: string;
    tipo: string;
    marca?: string;
    modelo?: string;
    sedeId: string;
    areaId?: string;
    ubicacionId?: string;
    responsableId?: string;
    estado?: string;
  }) {
    if (!entrada.placa?.trim() && !entrada.serial?.trim()) {
      throw new HttpException({ code: 'validation_error', message: 'El equipo necesita placa o serial.' }, HttpStatus.BAD_REQUEST);
    }
    return this.prisma.equipo.create({
      data: {
        placa: entrada.placa?.trim() || null,
        serial: entrada.serial?.trim() || null,
        tipo: entrada.tipo.trim(),
        marca: entrada.marca?.trim() || null,
        modelo: entrada.modelo?.trim() || null,
        sedeId: entrada.sedeId,
        areaId: entrada.areaId || null,
        ubicacionId: entrada.ubicacionId || null,
        responsableId: entrada.responsableId || null,
        estado: entrada.estado?.trim() || 'Operativo',
      },
    });
  }

  async crearPlan(entrada: {
    nombre: string;
    tipoEquipo: string;
    frecuencia: Frecuencia;
    items: ItemChecklist[];
    areaIds?: string[];
    equipoIds?: string[];
  }) {
    const equipos = await this.prisma.equipo.count({ where: { deletedAt: null, tipo: entrada.tipoEquipo } });
    if (equipos === 0) {
      throw new HttpException({ code: 'conflict', message: 'Sin inventario de ese tipo no hay plan.' }, HttpStatus.CONFLICT);
    }
    if (!entrada.items.some((item) => item.obligatorio)) {
      throw new HttpException({ code: 'validation_error', message: 'El checklist necesita al menos un ítem obligatorio.' }, HttpStatus.BAD_REQUEST);
    }
    return this.prisma.planPreventivo.create({
      data: {
        nombre: entrada.nombre.trim(),
        tipoEquipo: entrada.tipoEquipo.trim(),
        frecuencia: entrada.frecuencia,
        checklist: { items: entrada.items, areaIds: entrada.areaIds ?? [], equipoIds: entrada.equipoIds ?? [] } as Prisma.InputJsonValue,
      },
    });
  }

  planes() {
    return this.prisma.planPreventivo.findMany({
      where: { deletedAt: null },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, tipoEquipo: true, frecuencia: true, anticipacionDias: true, checklist: true, activo: true },
    });
  }

  async generar(ahora = new Date()) {
    const parametro = await this.prisma.configuracion.findUnique({ where: { clave: 'anticipacion_ordenes_dias' } });
    const anticipacion = Number(parametro?.valor ?? 15);
    const planes = await this.prisma.planPreventivo.findMany({ where: { activo: true, deletedAt: null } });
    const creadas: string[] = [];
    for (const plan of planes) {
      const detalle = leerPlan(plan.checklist);
      const equipos = await this.prisma.equipo.findMany({
        where: {
          deletedAt: null,
          tipo: plan.tipoEquipo,
          ...(detalle.equipoIds.length ? { id: { in: detalle.equipoIds } } : {}),
          ...(detalle.areaIds.length ? { areaId: { in: detalle.areaIds } } : {}),
        },
      });
      for (const equipo of equipos) {
        const ultima = await this.prisma.ordenPreventiva.findFirst({
          where: { planId: plan.id, equipoId: equipo.id },
          orderBy: { fechaProgramada: 'desc' },
        });
        const fecha = ultima
          ? sumarFrecuencia(ultima.fechaProgramada, plan.frecuencia)
          : new Date(ahora.getTime() + anticipacion * 86_400_000);
        if (!dentroDeAnticipacion(fecha, ahora, anticipacion)) {
          continue;
        }
        const ya = await this.prisma.ordenPreventiva.findFirst({
          where: { planId: plan.id, equipoId: equipo.id, fechaProgramada: fecha },
        });
        if (ya) {
          continue;
        }
        const tecnico = await this.prisma.usuario.findFirst({
          where: { rol: 'TECNICO', activo: true, deletedAt: null, sedeId: equipo.sedeId, niveles: { some: { nivel: 'N2' } } },
          select: { id: true },
        });
        const numero = await this.siguiente('PV');
        const orden = await this.prisma.ordenPreventiva.create({
          data: {
            numero,
            planId: plan.id,
            equipoId: equipo.id,
            fechaProgramada: fecha,
            tecnicoId: tecnico?.id,
            estado: tecnico ? 'ASIGNADA' : 'PROGRAMADA',
          },
        });
        creadas.push(orden.numero);
        const jefes = await this.prisma.usuario.findMany({
          where: { esJefeArea: true, activo: true, deletedAt: null, ...(equipo.areaId ? { areaId: equipo.areaId } : {}) },
          select: { id: true },
        });
        if (jefes.length) {
          await this.avisos.avisar({
            evento: 'preventivo_proximo',
            usuarios: jefes.map((jefe) => jefe.id),
            titulo: `Visita preventiva ${orden.numero}`,
            cuerpo: `El equipo se revisa el ${fecha.toLocaleDateString('es-CO')}.`,
            clave: () => `preventivo_proximo:${orden.id}`,
          });
        }
      }
    }
    return { creadas, anticipacion };
  }

  async calendario(mes: string) {
    const [anio, numero] = mes.split('-').map(Number);
    const inicio = new Date(anio, (numero || 1) - 1, 1);
    const fin = new Date(anio, numero || 1, 1);
    const ordenes = await this.prisma.ordenPreventiva.findMany({
      where: { fechaProgramada: { gte: inicio, lt: fin } },
      orderBy: { fechaProgramada: 'asc' },
      include: {
        equipo: { select: { tipo: true, placa: true, sede: { select: { nombre: true } }, area: { select: { nombre: true } } } },
        tecnico: { select: { nombre: true } },
        actas: { select: { estado: true } },
      },
    });
    return ordenes.map((orden) => ({
      id: orden.id,
      numero: orden.numero,
      fecha: orden.fechaProgramada,
      estado: orden.actas.some((acta) => acta.estado === 'CERRADO_CON_ACTA') ? 'CERRADA_CON_ACTA' : orden.estado,
      sede: orden.equipo.sede?.nombre ?? '',
      area: orden.equipo.area?.nombre ?? '',
      tipo: orden.equipo.tipo,
      placa: orden.equipo.placa,
      tecnico: orden.tecnico?.nombre ?? 'Sin técnico',
    }));
  }

  async orden(id: string) {
    const orden = await this.prisma.ordenPreventiva.findUnique({
      where: { id },
      include: { plan: true, equipo: { select: { placa: true, tipo: true, serial: true } }, tecnico: { select: { nombre: true } } },
    });
    if (!orden) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró la orden.' }, HttpStatus.NOT_FOUND);
    }
    return { ...orden, plan: { ...orden.plan, detalle: leerPlan(orden.plan.checklist) } };
  }

  async ejecutar(actor: Principal, id: string, resultados: ResultadoItem[]) {
    const orden = await this.prisma.ordenPreventiva.findUnique({ where: { id }, include: { plan: true, actas: true } });
    if (!orden) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró la orden.' }, HttpStatus.NOT_FOUND);
    }
    const faltan = faltanObligatorios(leerPlan(orden.plan.checklist).items, resultados);
    if (faltan.length) {
      throw new HttpException(
        { code: 'conflict', message: `Faltan ítems obligatorios: ${faltan.join(', ')}` },
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.ordenPreventiva.update({
      where: { id },
      data: { resultados: resultados as unknown as Prisma.InputJsonValue, estado: 'PENDIENTE_DE_FIRMA' },
    });
    if (!orden.actas.length) {
      await this.actas.generar(actor, {
        ordenId: id,
        diagnostico: 'Mantenimiento preventivo ejecutado',
        actividades: resultados.map((fila) => `${fila.itemId}: ${fila.valor ?? 'foto'}`).join('. '),
        estadoFinal: 'Revisado',
      });
    }
    return { estado: 'PENDIENTE_DE_FIRMA', faltan: 0 };
  }

  async reprogramar(actor: Principal, id: string, fecha: string, motivo: string) {
    if (!motivo.trim()) {
      throw new HttpException({ code: 'validation_error', message: 'La reprogramación exige un motivo.' }, HttpStatus.BAD_REQUEST);
    }
    const orden = await this.prisma.ordenPreventiva.findUnique({ where: { id } });
    if (!orden) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró la orden.' }, HttpStatus.NOT_FOUND);
    }
    const previas = Array.isArray(orden.reprogramaciones) ? orden.reprogramaciones : [];
    const nueva = new Date(fecha);
    await this.prisma.ordenPreventiva.update({
      where: { id },
      data: {
        fechaProgramada: nueva,
        estado: 'REPROGRAMADA',
        reprogramaciones: [...previas, { fechaAnterior: orden.fechaProgramada, fechaNueva: nueva, motivo: motivo.trim(), usuarioId: actor.id }] as Prisma.InputJsonValue,
      },
    });
    return { estado: 'REPROGRAMADA' };
  }

  async vencer(ahora = new Date()) {
    const vencidas = await this.prisma.ordenPreventiva.findMany({
      where: { fechaProgramada: { lt: ahora }, estado: { in: ['PROGRAMADA', 'ASIGNADA', 'REPROGRAMADA'] } },
      select: { id: true, numero: true },
    });
    if (!vencidas.length) {
      return { vencidas: 0 };
    }
    await this.prisma.ordenPreventiva.updateMany({
      where: { id: { in: vencidas.map((orden) => orden.id) } },
      data: { estado: 'VENCIDA' },
    });
    const admins = await this.prisma.usuario.findMany({
      where: { rol: 'ADMINISTRADOR', activo: true, deletedAt: null },
      select: { id: true },
    });
    await this.avisos.avisar({
      evento: 'orden_vencida',
      usuarios: admins.map((admin) => admin.id),
      titulo: 'Órdenes preventivas vencidas',
      cuerpo: vencidas.map((orden) => orden.numero).join(', '),
    });
    return { vencidas: vencidas.length };
  }

  async correctivo(actor: Principal, ordenId: string, titulo: string, descripcion: string) {
    const orden = await this.prisma.ordenPreventiva.findUnique({
      where: { id: ordenId },
      include: { equipo: true },
    });
    if (!orden) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró la orden.' }, HttpStatus.NOT_FOUND);
    }
    const categoria = await this.prisma.categoria.findFirst({ where: { deletedAt: null } });
    const prioridad = await this.prisma.prioridad.findFirst();
    if (!categoria || !prioridad || !orden.equipo.ubicacionId) {
      throw new HttpException({ code: 'conflict', message: 'Faltan catálogos o la ubicación del equipo.' }, HttpStatus.CONFLICT);
    }
    const numero = await this.siguiente('MA');
    const ticket = await this.prisma.ticket.create({
      data: {
        numero,
        tipo: 'CORRECTIVO',
        canalOrigen: 'WEB',
        solicitanteId: orden.equipo.responsableId ?? actor.id,
        categoriaId: categoria.id,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        sedeId: orden.equipo.sedeId,
        ubicacionId: orden.equipo.ubicacionId,
        equipoId: orden.equipoId,
        prioridadId: prioridad.id,
        nivel: 'N2',
        responsableId: orden.tecnicoId,
        estado: 'ASIGNADO',
      },
    });
    await this.prisma.historial.create({
      data: {
        ticketId: ticket.id,
        ordenId,
        usuarioId: actor.id,
        tipo: 'correctivo_desde_orden',
        datosNuevos: { orden: orden.numero, equipoId: orden.equipoId },
      },
    });
    return { id: ticket.id, numero: ticket.numero };
  }

  async historialEquipo(equipoId: string) {
    const [ordenes, tickets] = await Promise.all([
      this.prisma.ordenPreventiva.findMany({
        where: { equipoId },
        orderBy: { fechaProgramada: 'desc' },
        include: { actas: { select: { numero: true, version: true, estado: true } } },
      }),
      this.prisma.ticket.findMany({
        where: { equipoId, deletedAt: null },
        orderBy: { fechaCreacion: 'desc' },
        select: { numero: true, titulo: true, estado: true, fechaCreacion: true },
      }),
    ]);
    return {
      preventivos: ordenes.map((orden) => ({ numero: orden.numero, estado: orden.estado, fecha: orden.fechaProgramada, actas: orden.actas })),
      correctivos: tickets,
    };
  }

  async medir(desde: string, hasta: string) {
    const inicio = new Date(desde);
    const fin = new Date(hasta);
    const ordenes = await this.prisma.ordenPreventiva.findMany({
      where: { fechaProgramada: { gte: inicio, lt: fin } },
      include: { actas: { select: { estado: true } } },
    });
    const conActa = ordenes.filter((orden) => orden.actas.some((acta) => acta.estado === 'CERRADO_CON_ACTA')).length;
    return { programadas: ordenes.length, conActa, porcentaje: cumplimiento(ordenes.length, conActa) };
  }

  async registrarDelegado(actorId: string, delegadoId: string, areaId: string) {
    const actor = await this.prisma.usuario.findUnique({ where: { id: actorId } });
    if (!actor?.esJefeArea && actor?.rol !== 'ADMINISTRADOR') {
      throw new HttpException({ code: 'forbidden', message: 'Solo el jefe del área registra delegados.' }, HttpStatus.FORBIDDEN);
    }
    if (actor.esJefeArea && actor.rol !== 'ADMINISTRADOR' && actor.areaId !== areaId) {
      throw new HttpException({ code: 'forbidden', message: 'Solo puedes delegar en tu área.' }, HttpStatus.FORBIDDEN);
    }
    return this.prisma.delegadoArea.upsert({
      where: { delegadoId_areaId: { delegadoId, areaId } },
      update: { activo: true, jefeId: actorId },
      create: { jefeId: actorId, delegadoId, areaId },
    });
  }

  delegados(areaId?: string) {
    return this.prisma.delegadoArea.findMany({
      where: { activo: true, ...(areaId ? { areaId } : {}) },
      include: { delegado: { select: { nombre: true } }, area: { select: { nombre: true } } },
    });
  }

  private async siguiente(prefijo: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      await tx.consecutivo.upsert({ where: { prefijo }, update: {}, create: { prefijo, valor: 0 } });
      const fila = await tx.consecutivo.update({ where: { prefijo }, data: { valor: { increment: 1 } } });
      return `${prefijo}-${String(fila.valor).padStart(4, '0')}`;
    });
  }
}
