import { Button } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorHttp, api } from '../api/http';

type Item = { id: string; texto: string; obligatorio: boolean; tipo: string; unidad?: string };
type Orden = {
  id: string;
  numero: string;
  estado: string;
  plan: { detalle: { items: Item[] } };
  equipo: { placa: string | null; tipo: string };
};

export function OrdenPreventivaPage() {
  const { id = '' } = useParams();
  const [orden, setOrden] = useState<Orden | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [fotos, setFotos] = useState<Record<string, boolean>>({});
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    api<Orden>(`/api/preventivo/ordenes/${id}`)
      .then(setOrden)
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se encontró la orden.'));
  }, [id]);

  async function ejecutar() {
    if (!orden) {
      return;
    }
    const resultados = orden.plan.detalle.items.map((item) => ({
      itemId: item.id,
      valor: valores[item.id],
      foto: item.tipo === 'foto' ? Boolean(fotos[item.id]) : undefined,
    }));
    try {
      await api(`/api/preventivo/ordenes/${id}/ejecutar`, { method: 'POST', body: { resultados } });
      setAviso('Checklist completo. El acta quedó pendiente de firma.');
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo cerrar la checklist.');
    }
  }

  if (!orden) {
    return <p>{aviso || 'Cargando la orden…'}</p>;
  }

  return (
    <section>
      <h1>{orden.numero}</h1>
      <p>
        {orden.equipo.tipo} · {orden.equipo.placa} · {orden.estado}
      </p>
      <p>Completa los ítems obligatorios. En el celular la lista va en una sola columna.</p>
      {aviso && <p className="aviso-db">{aviso}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {orden.plan.detalle.items.map((item) => (
          <li key={item.id} style={{ marginBottom: 16 }}>
            <label>
              {item.texto}
              {item.obligatorio ? ' (obligatorio)' : ''}
              {item.unidad ? ` · ${item.unidad}` : ''}
            </label>
            {item.tipo === 'foto' ? (
              <input type="file" accept="image/*" onChange={() => setFotos((actual) => ({ ...actual, [item.id]: true }))} />
            ) : (
              <input
                style={{ display: 'block', width: '100%', marginTop: 4 }}
                value={valores[item.id] ?? ''}
                onChange={(evento) => setValores((actual) => ({ ...actual, [item.id]: evento.target.value }))}
                placeholder={item.tipo === 'casilla' ? 'si' : 'valor'}
              />
            )}
          </li>
        ))}
      </ul>
      <Button type="primary" onClick={ejecutar} block>
        Generar acta
      </Button>
    </section>
  );
}
