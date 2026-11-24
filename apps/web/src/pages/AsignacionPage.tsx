import { Button } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorHttp, api } from '../api/http';

type Carga = {
  pendientes: { id: string; numero: string; titulo: string; nivel: string; estado: string }[];
  tecnicos: { id: string; nombre: string; sede: string; niveles: string[]; abiertos: number }[];
};

export function AsignacionPage() {
  const [carga, setCarga] = useState<Carga | null>(null);
  const [aviso, setAviso] = useState('');

  function cargar() {
    api<Carga>('/api/tickets/asignacion/carga')
      .then(setCarga)
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo ver la carga.'));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function asignar(ticketId: string, responsableId: string) {
    await api(`/api/tickets/${ticketId}/asignar`, { method: 'POST', body: { responsableId } });
    cargar();
  }

  return (
    <section>
      <h1>Asignación</h1>
      {aviso && <p className="aviso-db">{aviso}</p>}
      <h2>Pendientes</h2>
      <ul>
        {(carga?.pendientes ?? []).map((ticket) => (
          <li key={ticket.id}>
            <Link to={`/tickets/${ticket.id}`}>{ticket.numero}</Link> · {ticket.titulo} · {ticket.nivel}
            <select aria-label={`Asignar ${ticket.numero}`} defaultValue="" onChange={(evento) => asignar(ticket.id, evento.target.value)}>
              <option value="" disabled>
                Técnico
              </option>
              {(carga?.tecnicos ?? []).map((tecnico) => (
                <option key={tecnico.id} value={tecnico.id}>
                  {tecnico.nombre} · {tecnico.abiertos} abiertos
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <h2>Carga</h2>
      <ul>
        {(carga?.tecnicos ?? []).map((tecnico) => (
          <li key={tecnico.id}>
            {tecnico.nombre} · {tecnico.sede} · {tecnico.niveles.join(', ')} · {tecnico.abiertos} abiertos
          </li>
        ))}
      </ul>
      <Button onClick={cargar}>Actualizar</Button>
    </section>
  );
}
