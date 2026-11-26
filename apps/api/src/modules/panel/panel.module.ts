import { Controller, Get, Injectable, Module, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { SesionGuard } from '../auth/sesion.guard';

const CERRADOS = ['CERRADO', 'CERRADO_CON_ACTA', 'CERRADO_SIN_FIRMA', 'CANCELADO', 'DESCARTADO'] as const;

@Injectable()
export class PanelService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen() {
    const ahora = new Date();
    const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const hace30 = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const limite = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);
    const abiertos = await this.prisma.ticket.count({
      where: { deletedAt: null, estado: { notIn: [...CERRADOS] } },
    });
    const enNivelAlto = await this.prisma.ticket.count({
      where: { deletedAt: null, nivel: { in: ['N2', 'N3'] }, estado: { notIn: [...CERRADOS] } },
    });
    const conversacionesHoy = await this.prisma.conversacionIa.findMany({
      where: { fecha: { gte: inicioDia } },
      select: { decisiones: true },
    });
    const resueltosPorIaHoy = conversacionesHoy.filter((fila) => JSON.stringify(fila.decisiones).includes('resuelto')).length;
    const actasPendientes = await this.prisma.acta.count({ where: { estado: 'PENDIENTE_DE_FIRMA' } });
    const programadas = await this.prisma.ordenPreventiva.count({ where: { fechaProgramada: { gte: inicioMes } } });
    const conActa = await this.prisma.ordenPreventiva.count({
      where: { fechaProgramada: { gte: inicioMes }, actas: { some: { estado: 'CERRADO_CON_ACTA' } } },
    });
    const porCategoria = await this.prisma.ticket.groupBy({
      by: ['categoriaId'],
      where: { deletedAt: null, fechaCreacion: { gte: hace30 }, categoriaId: { not: null } },
      _count: { _all: true },
    });
    const categorias = await this.prisma.categoria.findMany({
      where: { id: { in: porCategoria.map((fila) => fila.categoriaId).filter((id): id is string => Boolean(id)) } },
      select: { id: true, nombre: true },
    });
    const nombres = new Map(categorias.map((categoria) => [categoria.id, categoria.nombre]));
    const porNivel = await this.prisma.ticket.groupBy({
      by: ['nivel'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const descartados = await this.prisma.ticket.count({ where: { estado: 'DESCARTADO', deletedAt: null } });
    const proximos = await this.prisma.ticket.findMany({
      where: {
        deletedAt: null,
        fechaObjetivoSolucion: { not: null, lte: limite },
        estado: { notIn: [...CERRADOS] },
      },
      orderBy: { fechaObjetivoSolucion: 'asc' },
      take: 8,
      select: { id: true, numero: true, titulo: true, nivel: true, fechaObjetivoSolucion: true },
    });
    return {
      abiertos,
      resueltosPorIaHoy,
      enN2N3: enNivelAlto,
      actasPendientes,
      preventivos: {
        programadas,
        conActa,
        porcentaje: programadas ? Math.round((conActa / programadas) * 1000) / 10 : 0,
      },
      porCategoria: porCategoria.map((fila) => ({
        categoria: nombres.get(fila.categoriaId ?? '') ?? 'Sin categoría',
        total: fila._count._all,
      })),
      porNivel: porNivel.map((fila) => ({ nivel: fila.nivel, total: fila._count._all })),
      descartados,
      proximos,
    };
  }
}

@Controller('api/panel')
@UseGuards(SesionGuard, PermisoGuard)
export class PanelController {
  constructor(private readonly panel: PanelService) {}

  @Get()
  @CualquierPermiso('reportes.ver')
  resumen() {
    return this.panel.resumen();
  }
}

@Module({
  imports: [AuthModule],
  controllers: [PanelController],
  providers: [PanelService],
})
export class PanelModule {}
