import { io, type Socket } from 'socket.io-client';

export function conectarTiempoReal(): Socket {
  return io({
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
  });
}
