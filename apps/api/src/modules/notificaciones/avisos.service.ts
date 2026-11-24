import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ColaService } from '../cola/cola.service';
import { MATRIZ_DEFECTO, canalesPara, matrizValida, type FilaMatriz } from './matriz';
import { TiempoRealGateway } from './tiempo-real.gateway';

const CLAVE_MATRIZ = 'matriz_notificaciones';

@Injectable()
export class AvisosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cola: ColaService,
    private readonly tiempo: TiempoRealGateway,
  ) {}

  async leerMatriz(): Promise<FilaMatriz[]> {
    const fila = await this.prisma.configuracion.findUnique({ where: { clave: CLAVE_MATRIZ } });
    if (!fila) {
      return MATRIZ_DEFECTO;
    }
    try {
      const valor = JSON.parse(fila.valor) as unknown;
      return matrizValida(valor) ? valor : MATRIZ_DEFECTO;
    } catch {
      return MATRIZ_DEFECTO;
    }
  }

  async guardarMatriz(filas: FilaMatriz[], usuarioId: string): Promise<FilaMatriz[]> {
    const previa = await this.leerMatriz();
    await this.prisma.configuracion.upsert({
      where: { clave: CLAVE_MATRIZ },
      update: { valor: JSON.stringify(filas), tipo: 'JSON' },
      create: {
        clave: CLAVE_MATRIZ,
        valor: JSON.stringify(filas),
        tipo: 'JSON',
        descripcion: 'Matriz de eventos y canales. Propuesta editable.',
      },
    });
    await this.prisma.historial.create({
      data: {
        usuarioId,
        tipo: 'matriz_notificaciones',
        datosPrevios: previa as unknown as Prisma.InputJsonValue,
        datosNuevos: filas as unknown as Prisma.InputJsonValue,
      },
    });
    return filas;
  }

  async avisar(entrada: {
    evento: string;
    usuarios: string[];
    titulo: string;
    cuerpo: string;
    clave?: (usuarioId: string) => string;
  }): Promise<void> {
    const matriz = await this.leerMatriz();
    const fila = matriz.find((item) => item.evento === entrada.evento);
    if (!fila || entrada.usuarios.length === 0) {
      return;
    }
    const personas = await this.prisma.usuario.findMany({
      where: { id: { in: entrada.usuarios }, activo: true, deletedAt: null },
      select: { id: true, celular: true, celularVerificado: true, correoNotificaciones: true },
    });
    for (const persona of personas) {
      const clave = entrada.clave?.(persona.id);
      if (clave) {
        const existe = await this.prisma.notificacion.findFirst({ where: { usuarioId: persona.id, evento: clave } });
        if (existe) {
          continue;
        }
      }
      const destino = canalesPara(fila, {
        celularVerificado: persona.celularVerificado,
        correo: persona.correoNotificaciones,
        conectado: this.tiempo.estaConectado(persona.id),
      });
      if (!destino.web && !destino.whatsapp && !destino.correo) {
        continue;
      }
      const aviso = await this.prisma.notificacion.create({
        data: {
          usuarioId: persona.id,
          evento: clave ?? entrada.evento,
          titulo: entrada.titulo,
          cuerpo: entrada.cuerpo,
        },
      });
      if (destino.web) {
        await this.prisma.notificacionEntrega.create({
          data: { notificacionId: aviso.id, canal: 'WEB', estado: 'PENDIENTE' },
        });
        this.tiempo.emitir(persona.id, 'notificacion', { id: aviso.id, titulo: entrada.titulo, cuerpo: entrada.cuerpo });
      }
      if (destino.whatsapp && persona.celular && entrada.evento !== 'whatsapp_fallo') {
        try {
          await this.cola.encolar('whatsapp', { destino: persona.celular, texto: `${entrada.titulo}. ${entrada.cuerpo}` });
          await this.prisma.notificacionEntrega.create({
            data: { notificacionId: aviso.id, canal: 'WHATSAPP', estado: 'ENVIADO' },
          });
        } catch {
          await this.prisma.notificacionEntrega.create({
            data: { notificacionId: aviso.id, canal: 'WHATSAPP', estado: 'FALLIDO', detalle: 'cola' },
          });
          await this.compensarFallo(persona.correoNotificaciones, entrada.titulo, entrada.cuerpo, aviso.id);
        }
      }
      if (destino.correo && persona.correoNotificaciones) {
        await this.enviarCorreo(persona.correoNotificaciones, entrada.titulo, entrada.cuerpo, aviso.id);
      }
    }
  }

  private async compensarFallo(correo: string | null, titulo: string, cuerpo: string, avisoId: string): Promise<void> {
    if (correo) {
      await this.enviarCorreo(correo, titulo, cuerpo, avisoId);
    }
    const admins = await this.prisma.usuario.findMany({
      where: { rol: 'ADMINISTRADOR', activo: true, deletedAt: null },
      select: { id: true },
    });
    await this.avisar({
      evento: 'whatsapp_fallo',
      usuarios: admins.map((admin) => admin.id),
      titulo: 'Falló un envío de WhatsApp',
      cuerpo: 'Se reintenta por correo y queda el aviso en la mesa.',
    });
  }

  private async enviarCorreo(destino: string, titulo: string, cuerpo: string, avisoId: string): Promise<void> {
    try {
      await this.cola.encolar('correo', { destino, texto: `${titulo}. ${cuerpo}`, evento: 'correo' });
      await this.prisma.notificacionEntrega.create({
        data: { notificacionId: avisoId, canal: 'CORREO', estado: 'ENVIADO' },
      });
    } catch {
      await this.prisma.notificacionEntrega.create({
        data: { notificacionId: avisoId, canal: 'CORREO', estado: 'FALLIDO', detalle: 'cola' },
      });
    }
  }
}
