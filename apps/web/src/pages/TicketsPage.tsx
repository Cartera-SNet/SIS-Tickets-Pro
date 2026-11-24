import { Button, Form, Select } from 'antd';
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ErrorHttp, type Sesion, api } from '../api/http';

type Ticket = {
  id: string;
  numero: string;
  titulo: string;
  estadoNombre?: string;
  nivel: string;
  canal: string;
  categoria: string;
  fechaObjetivoSolucion: string | null;
};

export function TicketsPage() {
  const sesion = useOutletContext<Sesion | null>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [aviso, setAviso] = useState('');
  const [estado, setEstado] = useState<string>();
  const [nivel, setNivel] = useState<string>();
  const [canal, setCanal] = useState<string>();

  function cargar(filtros: { estado?: string; nivel?: string; canal?: string } = {}) {
    const params = new URLSearchParams();
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.nivel) params.set('nivel', filtros.nivel);
    if (filtros.canal) params.set('canal', filtros.canal);
    const consulta = params.toString();
    api<{ items: Ticket[] }>(`/api/tickets${consulta ? `?${consulta}` : ''}`)
      .then((cuerpo) => setTickets(cuerpo.items))
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se pudieron cargar los casos.'));
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <section>
      <h1>Tickets</h1>
      <p>
        Ves solo los casos que te autoriza tu rol{sesion ? `, ${sesion.nombre}` : ''}.{' '}
        <Link to="/tickets/nuevo">Reportar un caso</Link>
      </p>
      <Form
        layout="inline"
        style={{ marginBottom: 16 }}
        onFinish={() => cargar({ estado, nivel, canal })}
      >
        <Select
          allowClear
          placeholder="Estado"
          style={{ width: 180 }}
          value={estado}
          onChange={setEstado}
          options={['NUEVO', 'EN_ATENCION_N1', 'RESUELTO', 'DESCARTADO', 'CERRADO', 'REABIERTO'].map((value) => ({
            value,
            label: value,
          }))}
        />
        <Select
          allowClear
          placeholder="Nivel"
          style={{ width: 100 }}
          value={nivel}
          onChange={setNivel}
          options={['N1', 'N2', 'N3'].map((value) => ({ value, label: value }))}
        />
        <Select
          allowClear
          placeholder="Canal"
          style={{ width: 120 }}
          value={canal}
          onChange={setCanal}
          options={[
            { value: 'WEB', label: 'Web' },
            { value: 'WHATSAPP', label: 'WhatsApp' },
          ]}
        />
        <Button htmlType="submit">Filtrar</Button>
      </Form>
      {aviso && <p className="aviso-db">{aviso}</p>}
      {!aviso && tickets.length === 0 && <p>No tienes casos.</p>}
      <ul>
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link to={`/tickets/${ticket.id}`}>
              {ticket.numero} · {ticket.titulo} · {ticket.estadoNombre} · {ticket.nivel} · {ticket.canal}
              {ticket.categoria ? ` · ${ticket.categoria}` : ''}
            </Link>
            {ticket.fechaObjetivoSolucion && (
              <span> · vence {new Date(ticket.fechaObjetivoSolucion).toLocaleString('es-CO')}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
