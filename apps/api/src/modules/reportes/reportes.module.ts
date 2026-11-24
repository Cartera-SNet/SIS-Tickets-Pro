import { Controller, Get, Injectable, Module, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { SesionGuard } from '../auth/sesion.guard';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen() {
    const porNivel = await this.prisma.ticket.groupBy({
      by: ['nivel'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const satisfaccion = await this.prisma.ticket.aggregate({
      where: { calificacion: { not: null } },
      _avg: { calificacion: true },
      _count: { calificacion: true },
    });
    const cerrados = await this.prisma.ticket.findMany({
      where: { fechaResolucion: { not: null }, deletedAt: null },
      select: { fechaCreacion: true, fechaResolucion: true, fechaObjetivoSolucion: true },
      take: 300,
    });
    const horas = cerrados
      .map((ticket) => (ticket.fechaResolucion!.getTime() - ticket.fechaCreacion.getTime()) / 3_600_000)
      .filter((valor) => valor >= 0);
    const promedioHoras = horas.length ? Math.round((horas.reduce((a, b) => a + b, 0) / horas.length) * 10) / 10 : 0;
    const conMeta = cerrados.filter((ticket) => ticket.fechaObjetivoSolucion);
    const aTiempo = conMeta.filter((ticket) => ticket.fechaResolucion! <= ticket.fechaObjetivoSolucion!).length;
    const cumplimientoAns = conMeta.length ? Math.round((aTiempo / conMeta.length) * 1000) / 10 : 0;
    const conversaciones = await this.prisma.conversacionIa.findMany({ select: { decisiones: true }, take: 500 });
    const resueltosPorIa = conversaciones.filter((fila) => JSON.stringify(fila.decisiones).includes('resuelto_n1')).length;
    const equipos = await this.prisma.ticket.groupBy({
      by: ['equipoId'],
      where: { equipoId: { not: null }, deletedAt: null },
      _count: { _all: true },
      orderBy: { _count: { equipoId: 'desc' } },
      take: 5,
    });
    return {
      porNivel: porNivel.map((fila) => ({ nivel: fila.nivel, total: fila._count._all })),
      satisfaccion: satisfaccion._avg.calificacion ?? 0,
      calificaciones: satisfaccion._count.calificacion,
      promedioHoras,
      cumplimientoAns,
      casosConMeta: conMeta.length,
      atencionesAgente: conversaciones.length,
      resueltosPorIa,
      equipos: equipos.map((fila) => ({ equipoId: fila.equipoId, total: fila._count._all })),
    };
  }
}

@Controller('api/reportes')
@UseGuards(SesionGuard, PermisoGuard)
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('servicio')
  @CualquierPermiso('reportes.ver')
  servicio() {
    return this.reportes.resumen();
  }
}

@Module({
  imports: [AuthModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
