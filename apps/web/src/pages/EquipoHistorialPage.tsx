import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorHttp, api } from '../api/http';

type Historial = {
  preventivos: { numero: string; estado: string; fecha: string; actas: { numero: string; estado: string }[] }[];
  correctivos: { numero: string; titulo: string; estado: string }[];
};

export function EquipoHistorialPage() {
  const { id = '' } = useParams();
  const [historial, setHistorial] = useState<Historial | null>(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    api<Historial>(`/api/preventivo/equipos/${id}/historial`)
      .then(setHistorial)
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No hay historial.'));
  }, [id]);

  if (!historial) {
    return <p>{aviso || 'Cargando el equipo…'}</p>;
  }

  return (
    <section>
      <h1>Historial del equipo</h1>
      {aviso && <p className="aviso-db">{aviso}</p>}
      <h2>Preventivos</h2>
      <ul>
        {historial.preventivos.map((orden) => (
          <li key={orden.numero}>
            {orden.numero} · {orden.estado} · {orden.actas.map((acta) => acta.estado).join(', ') || 'sin acta'}
          </li>
        ))}
      </ul>
      <h2>Correctivos</h2>
      <ul>
        {historial.correctivos.map((ticket) => (
          <li key={ticket.numero}>
            {ticket.numero} · {ticket.titulo} · {ticket.estado}
          </li>
        ))}
      </ul>
    </section>
  );
}
