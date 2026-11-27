import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { leerCookie } from '../auth/cripto';
import { salaSede, salaTicket, salaUsuario } from './salas';

@WebSocketGateway({
  // Mismo origen en Railway; origin:true refleja el Origin de la petición (evita bloquear el WS).
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class TiempoRealGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  servidor!: Server;

  /** usuarioId → cantidad de sockets abiertos (varias pestañas). */
  private readonly socketsPorUsuario = new Map<string, number>();

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  estaConectado(usuarioId: string): boolean {
    return (this.socketsPorUsuario.get(usuarioId) ?? 0) > 0;
  }

  emitir(usuarioId: string, evento: string, datos: object): void {
    this.servidor?.to(salaUsuario(usuarioId)).emit(evento, datos);
  }

  emitirTicket(ticketId: string, evento: string, datos: object): void {
    this.servidor?.to(salaTicket(ticketId)).emit(evento, datos);
  }

  emitirSede(sedeId: string, evento: string, datos: object): void {
    this.servidor?.to(salaSede(sedeId)).emit(evento, datos);
  }

  /** Avisa a todos los clientes conectados (bandeja de mesa). */
  emitirMesa(evento: string, datos: object): void {
    this.servidor?.emit(evento, datos);
  }

  async handleConnection(cliente: Socket): Promise<void> {
    const token = leerCookie(cliente.handshake.headers.cookie, 'sis_sesion');
    const usuario = await this.auth.resolver(token);
    if (!usuario) {
      cliente.disconnect();
      return;
    }
    cliente.data.usuarioId = usuario.id;
    const previos = this.socketsPorUsuario.get(usuario.id) ?? 0;
    this.socketsPorUsuario.set(usuario.id, previos + 1);
    await cliente.join(salaUsuario(usuario.id));
    if (usuario.sedeId) {
      await cliente.join(salaSede(usuario.sedeId));
    }
    cliente.emit('tiempo-real:listo', { usuarioId: usuario.id });
    const pendientes = await this.prisma.notificacion.findMany({
      where: { usuarioId: usuario.id, lecturas: { none: { usuarioId: usuario.id } } },
      orderBy: { fecha: 'desc' },
      take: 20,
      select: { id: true, titulo: true, cuerpo: true, fecha: true },
    });
    for (const aviso of pendientes) {
      await this.marcarCanal(aviso.id, 'ENTREGADO');
    }
    cliente.emit('pendientes', pendientes);
  }

  handleDisconnect(cliente: Socket): void {
    const usuarioId = cliente.data.usuarioId as string | undefined;
    if (!usuarioId) {
      return;
    }
    const previos = this.socketsPorUsuario.get(usuarioId) ?? 1;
    if (previos <= 1) {
      this.socketsPorUsuario.delete(usuarioId);
    } else {
      this.socketsPorUsuario.set(usuarioId, previos - 1);
    }
  }

  private async marcarCanal(notificacionId: string, estado: 'ENTREGADO' | 'LEIDO'): Promise<void> {
    const previa = await this.prisma.notificacionEntrega.findFirst({
      where: { notificacionId, canal: 'WEB' },
    });
    if (previa) {
      await this.prisma.notificacionEntrega.update({ where: { id: previa.id }, data: { estado } });
      return;
    }
    await this.prisma.notificacionEntrega.create({
      data: { notificacionId, canal: 'WEB', estado },
    });
  }

  @SubscribeMessage('ticket:unirse')
  async unirse(@ConnectedSocket() cliente: Socket, @MessageBody() ticketId: string): Promise<void> {
    if (!cliente.data.usuarioId || typeof ticketId !== 'string' || !/^[0-9a-f-]{36}$/i.test(ticketId)) {
      return;
    }
    await cliente.join(salaTicket(ticketId));
    cliente.emit('ticket:unido', { ticketId });
  }

  @SubscribeMessage('ticket:salir')
  async salir(@ConnectedSocket() cliente: Socket, @MessageBody() ticketId: string): Promise<void> {
    if (!cliente.data.usuarioId || typeof ticketId !== 'string' || !/^[0-9a-f-]{36}$/i.test(ticketId)) {
      return;
    }
    await cliente.leave(salaTicket(ticketId));
  }

  @SubscribeMessage('escribiendo')
  escribiendo(@ConnectedSocket() cliente: Socket, @MessageBody() ticketId: string): void {
    if (!cliente.data.usuarioId || typeof ticketId !== 'string') {
      return;
    }
    cliente.to(salaTicket(ticketId)).emit('escribiendo', { ticketId, usuarioId: cliente.data.usuarioId });
  }
}
