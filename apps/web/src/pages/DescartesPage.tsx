import { Button } from 'antd';
import { useEffect, useState } from 'react';
import { ErrorHttp, api } from '../api/http';

type Descarte = { id: string; numero: string; titulo: string; estadoNombre?: string };

export function DescartesPage() {
  const [casos, setCasos] = useState<Descarte[]>([]);
  const [aviso, setAviso] = useState('');

  function cargar() {
    api<{ items: Descarte[] }>('/api/tickets?estado=DESCARTADO')
      .then((cuerpo) => setCasos(cuerpo.items))
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se cargaron los descartes.'));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function reabrir(id: string) {
    await api(`/api/tickets/${id}/reabrir-descarte`, { method: 'POST' });
    cargar();
  }

  return (
    <section>
      <h1>Solicitudes descartadas</h1>
      <p>Son pedidos de software. Si la clasificación se equivocó, se reabren como soporte.</p>
      {aviso && <p className="aviso-db">{aviso}</p>}
      <ul>
        {casos.map((caso) => (
          <li key={caso.id}>
            {caso.numero} · {caso.titulo}
            <Button onClick={() => reabrir(caso.id)}>Reabrir como soporte</Button>
          </li>
        ))}
      </ul>
      {casos.length === 0 && <p>No hay descartes.</p>}
    </section>
  );
}
