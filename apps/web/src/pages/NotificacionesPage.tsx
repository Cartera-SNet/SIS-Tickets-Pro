import { Button } from 'antd';
import { useEffect, useState } from 'react';
import { ErrorHttp, api } from '../api/http';
import { conectarTiempoReal } from '../api/tiempo-real';

type Aviso = {
  id: string;
  titulo: string;
  cuerpo: string;
  fecha: string;
  entregas?: { canal: string; estado: string }[];
};

export function NotificacionesPage() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [enVivo, setEnVivo] = useState(false);
  const [error, setError] = useState('');

  function cargar() {
    api<Aviso[]>('/api/notificaciones')
      .then(setAvisos)
      .catch((fallo: unknown) => setError(fallo instanceof ErrorHttp ? fallo.message : 'No se cargaron los avisos.'));
  }

  useEffect(() => {
    cargar();
    const socket = conectarTiempoReal();
    socket.on('connect', () => setEnVivo(true));
    socket.on('disconnect', () => setEnVivo(false));
    socket.on('pendientes', () => cargar());
    socket.on('notificacion', () => cargar());
    return () => {
      socket.close();
    };
  }, []);

  async function marcar(id: string) {
    await api(`/api/notificaciones/${id}/leida`, { method: 'POST' });
    cargar();
  }

  return (
    <section>
      <h1>Notificaciones</h1>
      <p>{enVivo ? 'Conectado. Si se corta, al volver llegan las pendientes.' : 'Conectando…'}</p>
      {error && <p className="aviso-db">{error}</p>}
      <ul>
        {avisos.map((aviso) => (
          <li key={aviso.id}>
            <strong>{aviso.titulo}</strong>
            <p>{aviso.cuerpo}</p>
            <p>
              {(aviso.entregas ?? []).map((entrega) => `${entrega.canal}: ${entrega.estado}`).join(' · ') || 'WEB: pendiente'}
            </p>
            <Button onClick={() => marcar(aviso.id)}>Marcar leída</Button>
          </li>
        ))}
      </ul>
      {avisos.length === 0 && <p>No tienes avisos.</p>}
    </section>
  );
}
