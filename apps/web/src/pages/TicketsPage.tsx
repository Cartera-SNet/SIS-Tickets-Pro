import { Button, Input, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { ErrorHttp, type Sesion, api } from '../api/http';
import { ETIQUETA_ESTADO, claseEstado, claseNivel, etiquetaEstado } from '../ui/etiquetas';

type Ticket = {
  id: string;
  numero: string;
  titulo: string;
  estado: string;
  estadoNombre?: string;
  nivel: string;
  canal: string;
  categoria: string;
  responsableNombre?: string | null;
  fechaObjetivoSolucion: string | null;
};

export function TicketsPage() {
  const sesion = useOutletContext<Sesion | null>();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [aviso, setAviso] = useState('');
  const [estado, setEstado] = useState<string>();
  const [nivel, setNivel] = useState<string>();
  const [canal, setCanal] = useState<string>();
  const [busqueda, setBusqueda] = useState('');

  function cargar(filtros: { estado?: string; nivel?: string; canal?: string } = {}) {
    const params = new URLSearchParams();
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.nivel) params.set('nivel', filtros.nivel);
    if (filtros.canal) params.set('canal', filtros.canal);
    const consulta = params.toString();
    api<{ items: Ticket[] }>(`/api/tickets${consulta ? `?${consulta}` : ''}`)
      .then((cuerpo) => setTickets(cuerpo.items))
      .catch((error: unknown) =>
        setAviso(error instanceof ErrorHttp ? error.message : 'No se pudieron cargar los casos.'),
      );
  }

  useEffect(() => {
    cargar();
  }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter(
      (ticket) =>
        ticket.numero.toLowerCase().includes(q) ||
        ticket.titulo.toLowerCase().includes(q) ||
        (ticket.categoria ?? '').toLowerCase().includes(q),
    );
  }, [tickets, busqueda]);

  const abiertos = tickets.filter((ticket) => !['CERRADO', 'CERRADO_CON_ACTA', 'CERRADO_SIN_FIRMA', 'DESCARTADO', 'CANCELADO'].includes(ticket.estado)).length;

  return (
    <section>
      <div className="pagina-cabecera">
        <div>
          <h1>Bandeja de tickets</h1>
          <p>
            {abiertos} abiertos · filtrada según tus permisos
            {sesion ? ` · ${sesion.nombre}` : ''}
          </p>
        </div>
        {sesion?.permisos.includes('tickets.crear') && (
          <Button type="primary" onClick={() => navigate('/tickets/nuevo')}>
            + Nuevo ticket
          </Button>
        )}
      </div>

      <div className="filtros-fila">
        <Input
          allowClear
          placeholder="Buscar por número, asunto o categoría…"
          style={{ minWidth: 240, flex: 1 }}
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
        />
        <Select
          allowClear
          placeholder="Estado"
          style={{ width: 180 }}
          value={estado}
          onChange={setEstado}
          options={Object.entries(ETIQUETA_ESTADO).map(([value, label]) => ({ value, label }))}
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
          style={{ width: 130 }}
          value={canal}
          onChange={setCanal}
          options={[
            { value: 'WEB', label: 'Web' },
            { value: 'WHATSAPP', label: 'WhatsApp' },
          ]}
        />
        <Button type="primary" onClick={() => cargar({ estado, nivel, canal })}>
          Filtrar
        </Button>
      </div>

      {aviso && <p className="aviso-db">{aviso}</p>}

      <article className="tabla-caja">
        {!aviso && visibles.length === 0 && <p>No tienes casos con estos filtros.</p>}
        {visibles.length > 0 && (
          <table className="tabla-sis">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Asunto</th>
                <th>Categoría</th>
                <th>Nivel</th>
                <th>Canal</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Link to={`/tickets/${ticket.id}`}>{ticket.numero}</Link>
                  </td>
                  <td>{ticket.titulo}</td>
                  <td>{ticket.categoria || '—'}</td>
                  <td>
                    <span className={claseNivel(ticket.nivel)}>{ticket.nivel}</span>
                  </td>
                  <td>{ticket.canal === 'WHATSAPP' ? 'WhatsApp' : 'Web'}</td>
                  <td>
                    <span className={claseEstado(ticket.estado)}>
                      {etiquetaEstado(ticket.estado, ticket.estadoNombre)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {visibles.length > 0 && (
          <p style={{ margin: '12px 0 0', fontSize: '0.85rem' }}>
            Mostrando {visibles.length} de {tickets.length}
          </p>
        )}
      </article>
    </section>
  );
}
