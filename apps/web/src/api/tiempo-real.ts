import { io, type Socket } from 'socket.io-client';

export function conectarTiempoReal(): Socket {
  return io({ path: '/socket.io', withCredentials: true, transports: ['websocket'] });
}
