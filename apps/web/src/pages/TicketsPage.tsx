import { Button, Input, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { ErrorHttp, type Sesion, api } from '../api/http';
import { conectarTiempoReal } from '../api/tiempo-real';
import {
  ETIQUETA_ESTADO,
  claseAns,
  claseEstado,
  claseNivel,
  etiquetaEstado,
  restanteAns,
} from '../ui/etiquetas';
import { useToasts } from '../ui/Toasts';

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

const CERRADOS = new Set([
  'CERRADO',
  'CERRADO_CON_ACTA',
  'CERRADO_SIN_FIRMA',
  'DESCARTADO',
  'CANCELADO',
]);

export function TicketsPage() {
  const sesion = useOutletContext<Sesion | null>();
  const navigate = useNavigate();
  const { mostrar } = useToasts();
  const [params] = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [aviso, setAviso] = useState('');
  const [estado, setEstado] = useState<string>();
  const [nivel, setNivel] = useState<string>();
  const [canal, setCanal] = useState<string>();
  const [busqueda, setBusqueda] = useState(() => params.get('q') ?? '');
  const veBandejaMesa = Boolean(sesion?.permisos.includes('tickets.ver_sede'));

  function cargar(filtros: { estado?: string; nivel?: string; canal?: string } = {}) {
    const consulta = new URLSearchParams();
    if (filtros.estado) consulta.set('estado', filtros.estado);
    if (filtros.nivel) consulta.set('nivel', filtros.nivel);
    if (filtros.canal) consulta.set('canal', filtros.canal);
    const qs = consulta.toString();
    api<{ items: Ticket[] }>(`/api/tickets${qs ? `?${qs}` : ''}`)
      .then((cuerpo) => setTickets(cuerpo.items))
      .catch((error: unknown) =>
        setAviso(error instanceof ErrorHttp ? error.message : 'No se pudieron cargar los casos.'),
      );
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    const q = params.get('q');
    if (q !== null) {
      setBusqueda(q);
    }
  }, [params]);

  useEffect(() => {
    if (!veBandejaMesa) {
      return;
    }
    const socket = conectarTiempoReal();
    const onCreado = (payload: Ticket & { id: string; numero: string; titulo?: string }) => {
      setTickets((actual) => {
        if (actual.some((item) => item.id === payload.id)) {
          return actual;
        }
        return [
          {
            id: payload.id,
            numero: payload.numero,
            titulo: payload.titulo ?? 'Nuevo caso',
            estado: payload.estado ?? 'NUEVO',
            estadoNombre: payload.estadoNombre,
            nivel: payload.nivel ?? 'N1',
            canal: payload.canal ?? 'WEB',
            categoria: payload.categoria ?? '',
            responsableNombre: payload.responsableNombre ?? null,
            fechaObjetivoSolucion: payload.fechaObjetivoSolucion ?? null,
          },
          ...actual,
        ];
      });
      mostrar({
        titulo: `Nuevo ticket ${payload.numero}`,
        cuerpo: payload.titulo ?? 'Caso creado',
        href: `/tickets/${payload.id}`,
      });
    };
    socket.on('ticket:creado', onCreado);
    return () => {
      socket.off('ticket:creado', onCreado);
      socket.close();
    };
  }, [veBandejaMesa, mostrar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter(
      (ticket) =>
        ticket.numero.toLowerCase().includes(q) ||
        ticket.titulo.toLowerCase().includes(q) ||
        (ticket.categoria ?? '').toLowerCase().includes(q) ||
        (ticket.responsableNombre ?? '').toLowerCase().includes(q),
    );
  }, [tickets, busqueda]);

  const abiertos = tickets.filter((ticket) => !CERRADOS.has(ticket.estado)).length;
  const puedeCrear = sesion?.permisos.includes('tickets.crear');

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
        {puedeCrear && (
          <Button type="primary" onClick={() => navigate('/tickets/nuevo')}>
            + Nuevo ticket
          </Button>
        )}
      </div>

      <div className="filtros-barra">
        <Input
          allowClear
          placeholder="Buscar por número, asunto, categoría o responsable…"
          className="filtros-buscar"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
        />
        <Select
          allowClear
          placeholder="Estado"
          style={{ width: 170 }}
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
        {!aviso && visibles.length === 0 && (
          <div className="vacio-caja">
            <strong>No hay casos con estos filtros</strong>
            <p>Prueba limpiar la búsqueda o crea un ticket nuevo.</p>
            {puedeCrear && (
              <Button type="primary" onClick={() => navigate('/tickets/nuevo')}>
                + Nuevo ticket
              </Button>
            )}
          </div>
        )}
        {visibles.length > 0 && (
          <div className="tabla-scroll">
            <table className="tabla-sis">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Asunto</th>
                  <th>Categoría</th>
                  <th>Nivel</th>
                  <th>Canal</th>
                  <th>Responsable</th>
                  <th>ANS</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="fila-click"
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                  >
                    <td>
                      <Link to={`/tickets/${ticket.id}`} onClick={(e) => e.stopPropagation()}>
                        {ticket.numero}
                      </Link>
                    </td>
                    <td>
                      <span className="celda-asunto">{ticket.titulo}</span>
                    </td>
                    <td>{ticket.categoria || '—'}</td>
                    <td>
                      <span className={claseNivel(ticket.nivel)}>{ticket.nivel}</span>
                    </td>
                    <td>
                      <span className={ticket.canal === 'WHATSAPP' ? 'chip chip-ok' : 'chip'}>
                        {ticket.canal === 'WHATSAPP' ? 'WhatsApp' : 'Web'}
                      </span>
                    </td>
                    <td>{ticket.responsableNombre || 'Sin asignar'}</td>
                    <td className={claseAns(ticket.fechaObjetivoSolucion)}>
                      {restanteAns(ticket.fechaObjetivoSolucion)}
                    </td>
                    <td>
                      <span className={claseEstado(ticket.estado)}>
                        {etiquetaEstado(ticket.estado, ticket.estadoNombre)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {visibles.length > 0 && (
          <footer className="tabla-pie">
            <span>
              Mostrando {visibles.length} de {tickets.length}
            </span>
          </footer>
        )}
      </article>
    </section>
  );
}
