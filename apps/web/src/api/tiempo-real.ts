import { io, type Socket } from 'socket.io-client';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

let socketUnico: Socket | null = null;

/** Una sola conexión Socket.IO para toda la app (evita salas perdidas y toasts rotos). */
export function obtenerSocketTiempoReal(): Socket {
  if (socketUnico) {
    return socketUnico;
  }
  socketUnico = io({
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 600,
    reconnectionDelayMax: 6000,
    autoConnect: true,
  });
  return socketUnico;
}

/** @deprecated Preferir useTiempoReal(). Se mantiene por páginas que aún no migraron. */
export function conectarTiempoReal(): Socket {
  return obtenerSocketTiempoReal();
}

type Listener = (...args: never[]) => void;

type ContextoTiempoReal = {
  conectado: boolean;
  socket: Socket | null;
  unirseTicket: (ticketId: string) => void;
  salirTicket: (ticketId: string) => void;
  /** Indica que el chat de ese ticket está abierto y en foco (no mostrar toast de mensaje). */
  marcarChatEnFoco: (ticketId: string | null) => void;
  chatEnFocoId: string | null;
  on: (evento: string, listener: Listener) => () => void;
};

const Ctx = createContext<ContextoTiempoReal | null>(null);

export function TiempoRealProvider({ children }: { children: ReactNode }) {
  const [conectado, setConectado] = useState(false);
  const [chatEnFocoId, setChatEnFocoId] = useState<string | null>(null);
  const ticketsUnidos = useRef(new Set<string>());
  const chatEnFocoRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = obtenerSocketTiempoReal();
    const onConnect = () => {
      setConectado(true);
      for (const ticketId of ticketsUnidos.current) {
        socket.emit('ticket:unirse', ticketId);
      }
    };
    const onDisconnect = () => setConectado(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) {
      onConnect();
    }
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const unirseTicket = useCallback((ticketId: string) => {
    if (!ticketId) {
      return;
    }
    ticketsUnidos.current.add(ticketId);
    const socket = obtenerSocketTiempoReal();
    socket.emit('ticket:unirse', ticketId);
  }, []);

  const salirTicket = useCallback((ticketId: string) => {
    ticketsUnidos.current.delete(ticketId);
    const socket = obtenerSocketTiempoReal();
    socket.emit('ticket:salir', ticketId);
  }, []);

  const marcarChatEnFoco = useCallback((ticketId: string | null) => {
    chatEnFocoRef.current = ticketId;
    setChatEnFocoId(ticketId);
  }, []);

  const on = useCallback((evento: string, listener: Listener) => {
    const socket = obtenerSocketTiempoReal();
    socket.on(evento, listener as (...args: unknown[]) => void);
    return () => {
      socket.off(evento, listener as (...args: unknown[]) => void);
    };
  }, []);

  const valor = useMemo(
    () => ({
      conectado,
      socket: socketUnico,
      unirseTicket,
      salirTicket,
      marcarChatEnFoco,
      chatEnFocoId,
      on,
    }),
    [conectado, unirseTicket, salirTicket, marcarChatEnFoco, chatEnFocoId, on],
  );

  return createElement(Ctx.Provider, { value: valor }, children);
}

export function useTiempoReal() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useTiempoReal requiere TiempoRealProvider');
  }
  return ctx;
}
