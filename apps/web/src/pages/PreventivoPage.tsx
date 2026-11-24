import { Button } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorHttp, api } from '../api/http';

type Equipo = { id: string; placa: string | null; serial: string | null; tipo: string; estado: string; sede: { nombre: string } | null };
type Plan = { id: string; nombre: string; tipoEquipo: string; frecuencia: string };
type Dia = { id: string; numero: string; fecha: string; estado: string; sede: string; tipo: string; tecnico: string };
type Medida = { programadas: number; conActa: number; porcentaje: number };

const COLOR: Record<string, string> = {
  PROGRAMADA: 'var(--info)',
  ASIGNADA: 'var(--primary)',
  REPROGRAMADA: 'var(--warning)',
  PENDIENTE_DE_FIRMA: 'var(--warning)',
  CERRADA_CON_ACTA: 'var(--success)',
  VENCIDA: 'var(--danger)',
};

export function PreventivoPage() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [dias, setDias] = useState<Dia[]>([]);
  const [medida, setMedida] = useState<Medida | null>(null);
  const [aviso, setAviso] = useState('');
  const mes = new Date().toISOString().slice(0, 7);
  const siguiente = new Date();
  siguiente.setMonth(siguiente.getMonth() + 1);
  const mesSiguiente = siguiente.toISOString().slice(0, 7);

  function cargar() {
    api<Equipo[]>('/api/preventivo/equipos').then(setEquipos).catch(() => setEquipos([]));
    api<Plan[]>('/api/preventivo/planes').then(setPlanes).catch(() => setPlanes([]));
    Promise.all([
      api<Dia[]>(`/api/preventivo/calendario?mes=${mes}`),
      api<Dia[]>(`/api/preventivo/calendario?mes=${mesSiguiente}`),
    ])
      .then(([actual, proximo]) => setDias([...actual, ...proximo]))
      .catch(() => setDias([]));
    api<Medida>(`/api/preventivo/cumplimiento?desde=${mes}-01&hasta=${mesSiguiente}-01`)
      .then(setMedida)
      .catch(() => setMedida(null));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function generar() {
    try {
      const cuerpo = await api<{ creadas: string[] }>('/api/preventivo/generar', { method: 'POST' });
      setAviso(cuerpo.creadas.length ? `Órdenes: ${cuerpo.creadas.join(', ')}` : 'No había visitas dentro de la anticipación.');
      cargar();
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se generaron órdenes.');
    }
  }

  return (
    <section>
      <h1>Mantenimiento preventivo</h1>
      <p>Sin inventario no hay planes. La orden sale 15 días antes y avisa al jefe del área.</p>
      {aviso && <p className="aviso-db">{aviso}</p>}
      {medida && (
        <p>
          Cumplimiento del mes: {medida.porcentaje}% ({medida.conActa} con acta firmada de {medida.programadas} programadas)
        </p>
      )}
      <Button type="primary" onClick={generar}>
        Generar órdenes
      </Button>
      <h2>Inventario</h2>
      <ul>
        {equipos.map((equipo) => (
          <li key={equipo.id}>
            <Link to={`/preventivo/equipos/${equipo.id}`}>{equipo.placa ?? equipo.serial}</Link> · {equipo.tipo} · {equipo.estado} ·{' '}
            {equipo.sede?.nombre}
          </li>
        ))}
      </ul>
      <h2>Planes</h2>
      <ul>
        {planes.map((plan) => (
          <li key={plan.id}>
            {plan.nombre} · {plan.tipoEquipo} · {plan.frecuencia}
          </li>
        ))}
      </ul>
      <h2>Calendario</h2>
      <ul>
        {dias.map((dia) => (
          <li key={dia.id}>
            <Link to={`/preventivo/ordenes/${dia.id}`}>{dia.numero}</Link>
            <span style={{ color: COLOR[dia.estado] ?? 'inherit' }}> · {dia.estado}</span>
            {` · ${new Date(dia.fecha).toLocaleDateString('es-CO')} · ${dia.sede} · ${dia.tipo} · ${dia.tecnico}`}
          </li>
        ))}
      </ul>
      {dias.length === 0 && <p>No hay visitas en ese mes.</p>}
    </section>
  );
}
