import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const SEDES_SIMULADAS = [
  {
    codigo: '02',
    nombre: 'Sede Sur',
    ubicaciones: [{ nombre: 'Recepción', piso: '1', puesto: '1' }],
  },
  {
    codigo: '99',
    nombre: 'Sede Norte',
    ubicaciones: [] as { nombre: string; piso: string; puesto: string }[],
  },
];

@Injectable()
export class CatalogosService {
  constructor(private readonly prisma: PrismaService) {}

  categorias() {
    return this.prisma.categoria.findMany({
      where: { deletedAt: null, activo: true },
      orderBy: { nombre: 'asc' },
      include: { subcategorias: { where: { deletedAt: null, activo: true }, orderBy: { nombre: 'asc' } } },
    });
  }

  async crearCategoria(nombre: string) {
    return this.prisma.categoria.create({ data: { nombre: nombre.trim() } });
  }

  async desactivarCategoria(id: string) {
    return this.prisma.categoria.update({ where: { id }, data: { activo: false, deletedAt: new Date() } });
  }

  async crearSubcategoria(categoriaId: string, nombre: string) {
    return this.prisma.subcategoria.create({ data: { categoriaId, nombre: nombre.trim() } });
  }

  sedes() {
    return this.prisma.sede.findMany({
      where: { deletedAt: null, activo: true },
      orderBy: { nombre: 'asc' },
      include: { ubicaciones: { where: { deletedAt: null, activo: true } } },
    });
  }

  async crearSede(nombre: string, codigo?: string) {
    return this.prisma.sede.create({ data: { nombre: nombre.trim(), codigo: codigo?.trim() || null } });
  }

  async crearUbicacion(sedeId: string, nombre: string, piso?: string, puesto?: string) {
    return this.prisma.ubicacion.create({
      data: { sedeId, nombre: nombre.trim(), piso: piso?.trim() || null, puesto: puesto?.trim() || null },
    });
  }

  tiposPersonal() {
    return this.prisma.tipoPersonal.findMany({ where: { deletedAt: null }, orderBy: { nombre: 'asc' } });
  }

  async crearTipoPersonal(entrada: {
    nombre: string;
    descripcion?: string;
    celularPermitido: boolean;
    canalPreferido: 'WEB' | 'WHATSAPP' | 'CORREO';
  }) {
    return this.prisma.tipoPersonal.create({
      data: {
        nombre: entrada.nombre.trim(),
        descripcion: entrada.descripcion?.trim() || null,
        celularPermitido: entrada.celularPermitido,
        canalPreferido: entrada.canalPreferido,
      },
    });
  }

  async editarTipoPersonal(
    id: string,
    entrada: { nombre?: string; celularPermitido?: boolean; activo?: boolean },
  ) {
    return this.prisma.tipoPersonal.update({
      where: { id },
      data: {
        nombre: entrada.nombre?.trim(),
        celularPermitido: entrada.celularPermitido,
        activo: entrada.activo,
        deletedAt: entrada.activo === false ? new Date() : undefined,
      },
    });
  }

  prioridades() {
    return this.prisma.prioridad.findMany({ where: { activo: true }, orderBy: { codigo: 'asc' }, include: { versiones: { orderBy: { version: 'desc' }, take: 5 } } });
  }

  async actualizarAns(
    id: string,
    usuarioId: string,
    entrada: {
      primeraRespuestaValor: number;
      primeraRespuestaUnidad: 'MINUTOS' | 'HORAS' | 'DIAS_HABILES';
      solucionValor: number;
      solucionUnidad: 'MINUTOS' | 'HORAS' | 'DIAS_HABILES';
    },
  ) {
    const actual = await this.prisma.prioridad.findUnique({ where: { id } });
    if (!actual) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró la prioridad.' }, HttpStatus.NOT_FOUND);
    }
    const version = actual.version + 1;
    return this.prisma.$transaction(async (tx) => {
      await tx.ansVersion.create({
        data: {
          prioridadId: id,
          version,
          primeraRespuestaValor: entrada.primeraRespuestaValor,
          primeraRespuestaUnidad: entrada.primeraRespuestaUnidad,
          solucionValor: entrada.solucionValor,
          solucionUnidad: entrada.solucionUnidad,
          usuarioId,
        },
      });
      return tx.prioridad.update({
        where: { id },
        data: { ...entrada, version },
      });
    });
  }

  equipos(sedeId?: string | null) {
    return this.prisma.equipo.findMany({
      where: { deletedAt: null, ...(sedeId ? { sedeId } : {}) },
      orderBy: { placa: 'asc' },
      select: { id: true, placa: true, tipo: true, sedeId: true },
      take: 100,
    });
  }

  async sincronizarEsculapioSimulado() {
    const creadas: string[] = [];
    const sinCambios: string[] = [];
    const conflictos: { nombre: string; codigoLocal: string | null; codigoRemoto: string }[] = [];
    for (const remota of SEDES_SIMULADAS) {
      const porCodigo = await this.prisma.sede.findFirst({
        where: { codigoEsculapio: remota.codigo, deletedAt: null },
      });
      const porNombre = await this.prisma.sede.findFirst({
        where: { nombre: remota.nombre, deletedAt: null },
      });
      if (porNombre && porNombre.codigoEsculapio && porNombre.codigoEsculapio !== remota.codigo) {
        conflictos.push({
          nombre: remota.nombre,
          codigoLocal: porNombre.codigoEsculapio,
          codigoRemoto: remota.codigo,
        });
        continue;
      }
      const sede =
        porCodigo ??
        (await this.prisma.sede.create({
          data: { nombre: remota.nombre, codigo: remota.codigo, codigoEsculapio: remota.codigo },
        }));
      if (porCodigo) {
        sinCambios.push(remota.nombre);
      } else {
        creadas.push(remota.nombre);
      }
      for (const ubicacion of remota.ubicaciones) {
        const existe = await this.prisma.ubicacion.findFirst({
          where: { sedeId: sede.id, nombre: ubicacion.nombre, deletedAt: null },
        });
        if (!existe) {
          await this.prisma.ubicacion.create({
            data: { sedeId: sede.id, nombre: ubicacion.nombre, piso: ubicacion.piso, puesto: ubicacion.puesto },
          });
        }
      }
    }
    return { origen: 'simulado', creadas, sinCambios, conflictos };
  }
}
