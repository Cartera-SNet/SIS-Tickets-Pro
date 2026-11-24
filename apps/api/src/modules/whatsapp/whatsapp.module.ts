import { Controller, Get, HttpException, HttpStatus, Injectable, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppProvider } from '../../adapters/contratos';
import { WHATSAPP } from '../../adapters/adaptadores.module';
import { Inject } from '@nestjs/common';
import { ColaService } from '../cola/cola.service';
import { AuthModule } from '../auth/auth.module';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { SesionGuard } from '../auth/sesion.guard';
import { Module } from '@nestjs/common';
import { esHerramientaCerrada, firmaMetaValida, soloPlantilla } from './firma-meta';
import { AvisosService } from '../notificaciones/avisos.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AgenteIaModule } from '../agente-ia/agente-ia.module';
import { AgenteService } from '../agente-ia/agente.service';
import { POLITICA_REINTENTO } from '../auth/reglas-acceso';

const INSTRUCCIONES = 'Para reportar por WhatsApp verifica tu celular en la mesa de ayuda web y autoriza el uso de tus datos.';

@Injectable()
export class WhatsappService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP) private readonly whatsapp: WhatsAppProvider,
    private readonly cola: ColaService,
    private readonly agente: AgenteService,
    private readonly avisos: AvisosService,
  ) {}

  async recibir(raw: Buffer, firma: string | undefined, secreto: string) {
    if ((process.env.WHATSAPP_MODE ?? 'mock') === 'real' && !secreto) {
      throw new HttpException(
        { code: 'forbidden', message: 'Falta el secreto del webhook en las variables de entorno.' },
        HttpStatus.FORBIDDEN,
      );
    }
    if (!firmaMetaValida(raw, firma, secreto)) {
      throw new HttpException({ code: 'forbidden', message: 'La firma del webhook no es válida.' }, HttpStatus.FORBIDDEN);
    }
    const cuerpo = JSON.parse(raw.toString('utf8')) as {
      entry?: { changes?: { value?: { messages?: { id: string; from: string; type: string; text?: { body: string } }[]; statuses?: { id: string; status: string }[] } }[] }[];
    };
    let duplicados = 0;
    let atendidos = 0;
    for (const entrada of cuerpo.entry ?? []) {
      for (const cambio of entrada.changes ?? []) {
        for (const estado of cambio.value?.statuses ?? []) {
          await this.actualizarEntrega(estado.id, estado.status);
        }
        for (const mensaje of cambio.value?.messages ?? []) {
          const nuevo = await this.registrarEntrante(mensaje.id, mensaje.from, mensaje.type);
          if (!nuevo) {
            duplicados += 1;
            continue;
          }
          await this.responder(mensaje.from, mensaje.type, mensaje.text?.body ?? '');
          atendidos += 1;
        }
      }
    }
    return { atendidos, duplicados };
  }

  async enviar(telefono: string, texto: string, plantilla?: string) {
    const ultimo = await this.prisma.mensajeEntrante.findFirst({
      where: { telefono },
      orderBy: { recibido: 'desc' },
    });
    if (soloPlantilla(ultimo?.recibido ?? null, new Date()) && !plantilla) {
      throw new HttpException(
        { code: 'conflict', message: 'Fuera de la ventana de 24 horas solo se puede enviar una plantilla aprobada.' },
        HttpStatus.CONFLICT,
      );
    }
    if (plantilla) {
      const fila = await this.prisma.plantillaWhatsapp.findUnique({ where: { nombre: plantilla } });
      if (!fila || fila.estadoAprobacion !== 'aprobada') {
        throw new HttpException({ code: 'conflict', message: 'La plantilla no está aprobada.' }, HttpStatus.CONFLICT);
      }
    }
    try {
      const envio = await this.whatsapp.enviarTexto(telefono, plantilla ? `plantilla:${plantilla}` : texto);
      await this.prisma.envioWhatsapp.create({
        data: { idMeta: envio.id, telefono, tipo: plantilla ? 'plantilla' : 'texto', plantilla: plantilla ?? null, estado: 'ENVIADO' },
      });
      return envio;
    } catch (error) {
      await this.cola.encolar('whatsapp', { destino: telefono, texto, plantilla, fallo: false }, POLITICA_REINTENTO).catch(() => undefined);
      const admins = await this.prisma.usuario.findMany({ where: { rol: 'ADMINISTRADOR', activo: true }, select: { id: true } });
      await this.avisos.avisar({
        evento: 'whatsapp_fallo',
        usuarios: admins.map((admin) => admin.id),
        titulo: 'Falló un envío de WhatsApp',
        cuerpo: 'Se reintentará por la cola y, si sigue fallando, por correo.',
      });
      throw error;
    }
  }

  async ejecutarHerramienta(usuarioId: string, nombre: string, entrada: Record<string, unknown>) {
    if (!esHerramientaCerrada(nombre)) {
      throw new HttpException({ code: 'forbidden', message: 'Esa función no está permitida para el agente.' }, HttpStatus.FORBIDDEN);
    }
    let resultado: unknown = { registrado: true };
    if (nombre === 'buscar_articulo_kb') {
      const articulos = await this.prisma.baseConocimiento.findMany({
        where: {
          estado: 'PUBLICADO',
          deletedAt: null,
          ...(typeof entrada.categoriaId === 'string' ? { categoriaId: entrada.categoriaId } : {}),
          ...(typeof entrada.texto === 'string'
            ? { OR: [{ titulo: { contains: entrada.texto, mode: 'insensitive' } }, { pasos: { contains: entrada.texto, mode: 'insensitive' } }] }
            : {}),
        },
        take: 5,
        select: { id: true, codigo: true, titulo: true },
      });
      if (articulos[0]) {
        await this.prisma.baseConocimiento.update({ where: { id: articulos[0].id }, data: { usos: { increment: 1 } } });
      }
      resultado = articulos;
    }
    await this.prisma.conversacionIa.create({
      data: {
        usuarioId,
        decisiones: [{ herramienta: nombre, entrada, resultado }] as Prisma.InputJsonValue,
        transferencia: nombre === 'transferir_a_analista',
      },
    });
    return resultado;
  }

  private async registrarEntrante(idMeta: string, telefono: string, tipo: string): Promise<boolean> {
    try {
      await this.prisma.mensajeEntrante.create({ data: { idMeta, telefono, tipo } });
      return true;
    } catch {
      return false;
    }
  }

  private async responder(telefono: string, tipo: string, texto: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { celular: telefono, celularVerificado: true, deletedAt: null },
    });
    if (!usuario) {
      await this.whatsapp.enviarTexto(telefono, INSTRUCCIONES);
      return;
    }
    const respuesta = await this.agente.atender(usuario.id, texto, tipo === 'image' || tipo === 'document');
    await this.whatsapp.enviarTexto(telefono, respuesta);
  }

  private async actualizarEntrega(idMeta: string, status: string) {
    const mapa: Record<string, 'ENVIADO' | 'ENTREGADO' | 'LEIDO' | 'FALLIDO'> = {
      sent: 'ENVIADO',
      delivered: 'ENTREGADO',
      read: 'LEIDO',
      failed: 'FALLIDO',
    };
    const estado = mapa[status];
    if (!estado) return;
    await this.prisma.envioWhatsapp.updateMany({ where: { idMeta }, data: { estado, actualizado: new Date() } });
  }
}

@Controller('webhook')
export class WebhookController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Get('whatsapp')
  verificar(
    @Query('hub.mode') modo: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') reto: string,
    @Res() respuesta: Response,
  ) {
    if (modo === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      respuesta.status(200).send(reto);
      return;
    }
    respuesta.status(403).send('verificación rechazada');
  }

  @Post('whatsapp')
  recibir(@Req() peticion: Request & { rawBody?: Buffer }) {
    const raw = peticion.rawBody ?? Buffer.from(JSON.stringify(peticion.body ?? {}));
    return this.whatsapp.recibir(raw, peticion.header('x-hub-signature-256'), process.env.WHATSAPP_APP_SECRET ?? '');
  }
}

@Controller('api/whatsapp')
@UseGuards(SesionGuard, PermisoGuard)
export class PlantillasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('plantillas')
  @CualquierPermiso('configuracion.editar')
  plantillas() {
    return this.prisma.plantillaWhatsapp.findMany({ orderBy: { nombre: 'asc' } });
  }
}

@Module({
  imports: [AuthModule, AgenteIaModule, NotificacionesModule],
  controllers: [WebhookController, PlantillasController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
