import {
  CheckCircleOutlined,
  FileProtectOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorHttp, api } from '../api/http';
import { useTiempoReal } from '../api/tiempo-real';
import { claseAns, claseNivel, restanteAns } from '../ui/etiquetas';

type Panel = {
  abiertos: number;
  resueltosPorIaHoy: number;
  enN2N3: number;
  actasPendientes: number;
  preventivos: { porcentaje: number; programadas: number; conActa: number };
  porCategoria: { categoria: string; total: number }[];
  porNivel: { nivel: string; total: number }[];
  descartados: number;
  proximos: {
    id?: string;
    numero: string;
    titulo: string;
    nivel: string;
    fechaObjetivoSolucion: string;
    ubicacion?: string;
    responsable?: string;
  }[];
};

const COLOR_NIVEL: Record<string, string> = {
  N1: '#14a3a3',
  N2: '#e0a100',
  N3: '#e0413c',
};

type Kpi = {
  clave: string;
  etiqueta: string;
  valor: string | number;
  tono: string;
  icono: ReactNode;
};

export function InicioPage() {
  const navigate = useNavigate();
  const { on } = useTiempoReal();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [aviso, setAviso] = useState('');

  function cargar() {
    api<Panel>('/api/panel')
      .then(setPanel)
      .catch((error: unknown) => {
        setPanel(null);
        setAviso(error instanceof ErrorHttp && error.status === 403 ? '' : 'No se pudo cargar el panel.');
      });
  }

  useEffect(() => {
    cargar();
    const offConnect = on('connect', (() => cargar()) as (...args: never[]) => void);
    const offNotificacion = on('notificacion', (() => cargar()) as (...args: never[]) => void);
    const offMensaje = on('ticket:mensaje', (() => cargar()) as (...args: never[]) => void);
    const offCreado = on('ticket:creado', (() => cargar()) as (...args: never[]) => void);
    return () => {
      offConnect();
      offNotificacion();
      offMensaje();
      offCreado();
    };
  }, [on]);

  const maxCategoria = useMemo(
    () => Math.max(1, ...(panel?.porCategoria.map((fila) => fila.total) ?? [1])),
    [panel],
  );

  const totalNivel = useMemo(
    () => (panel?.porNivel.reduce((suma, fila) => suma + fila.total, 0) ?? 0) || 1,
    [panel],
  );

  const dona = useMemo(() => {
    if (!panel) return [];
    let acumulado = 0;
    return panel.porNivel.map((fila) => {
      const porcentaje = (fila.total / totalNivel) * 100;
      const inicio = acumulado;
      acumulado += porcentaje;
      return { ...fila, porcentaje, inicio, color: COLOR_NIVEL[fila.nivel] ?? '#8ea3b5' };
    });
  }, [panel, totalNivel]);

  if (!panel) {
    return (
      <section>
        <div className="hero-panel">
          <div>
            <p className="hero-eyebrow">SIS · Mesa de ayuda TI</p>
            <h1>Panel principal</h1>
            <p>Tus casos están en Tickets. El panel se completa con los indicadores de tu rol.</p>
          </div>
          <Button type="primary" onClick={() => navigate('/tickets')}>
            Ir a tickets
          </Button>
        </div>
        {aviso && <p className="aviso-db">{aviso}</p>}
      </section>
    );
  }

  const conic = dona
    .map((parte) => `${parte.color} ${parte.inicio}% ${parte.inicio + parte.porcentaje}%`)
    .join(', ');

  const kpis: Kpi[] = [
    {
      clave: 'abiertos',
      etiqueta: 'Abiertos',
      valor: panel.abiertos,
      tono: 'teal',
      icono: <ThunderboltOutlined />,
    },
    {
      clave: 'ia',
      etiqueta: 'Resueltos por IA hoy',
      valor: panel.resueltosPorIaHoy,
      tono: 'morado',
      icono: <RobotOutlined />,
    },
    {
      clave: 'escalados',
      etiqueta: 'En N2 / N3',
      valor: panel.enN2N3,
      tono: 'ambar',
      icono: <ToolOutlined />,
    },
    {
      clave: 'actas',
      etiqueta: 'Actas pendientes',
      valor: panel.actasPendientes,
      tono: 'azul',
      icono: <FileProtectOutlined />,
    },
    {
      clave: 'preventivos',
      etiqueta: 'Preventivos del mes',
      valor: `${panel.preventivos.porcentaje}%`,
      tono: 'verde',
      icono: <CheckCircleOutlined />,
    },
  ];

  return (
    <section>
      <div className="hero-panel">
        <div>
          <p className="hero-eyebrow">SIS · Mesa de ayuda TI</p>
          <h1>Diagnóstico operativo de la mesa</h1>
          <p>Indicadores en vivo de tickets, agente IA, actas y mantenimiento preventivo.</p>
        </div>
        <div className="hero-acciones">
          <Button type="primary" onClick={() => navigate('/tickets/nuevo')}>
            Nuevo ticket
          </Button>
          <Button onClick={() => navigate('/reportes')}>Ver reportes</Button>
        </div>
      </div>

      <div className="kpis">
        {kpis.map((kpi) => (
          <article className={`kpi kpi-icono ${kpi.tono}`} key={kpi.clave}>
            <div className="kpi-cabeza">
              <span className="kpi-icono-circulo" aria-hidden="true">
                {kpi.icono}
              </span>
              <span>{kpi.etiqueta}</span>
            </div>
            <strong>{kpi.valor}</strong>
          </article>
        ))}
      </div>

      <div className="panel-rejilla">
        <article className="panel-tarjeta">
          <div className="panel-titulo">
            <h2>Tickets por categoría · 30 días</h2>
            <span className="chip-suave">En vivo</span>
          </div>
          {panel.porCategoria.length === 0 && <p>Sin datos en el periodo.</p>}
          {panel.porCategoria.map((fila) => (
            <div className="barra-cat" key={fila.categoria}>
              <span>{fila.categoria}</span>
              <div className="barra-pista" aria-hidden="true">
                <div className="barra-lleno" style={{ width: `${(fila.total / maxCategoria) * 100}%` }} />
              </div>
              <strong>{fila.total}</strong>
            </div>
          ))}
        </article>

        <article className="panel-tarjeta">
          <div className="panel-titulo">
            <h2>Distribución por nivel</h2>
            <span className="chip-suave">SLA</span>
          </div>
          <div className="dona-caja">
            <div
              className="dona-svg"
              style={{
                borderRadius: '50%',
                background: `conic-gradient(${conic || '#1e3040 0 100%'})`,
                mask: 'radial-gradient(circle at center, transparent 48%, #000 49%)',
                WebkitMask: 'radial-gradient(circle at center, transparent 48%, #000 49%)',
              }}
              role="img"
              aria-label={`Total ${totalNivel} tickets por nivel`}
            />
            <div className="dona-leyenda">
              {dona.map((parte) => (
                <div key={parte.nivel}>
                  <i style={{ background: parte.color }} />
                  {parte.nivel}: {parte.total} ({Math.round(parte.porcentaje)}%)
                </div>
              ))}
              <p className="dona-nota">Descartados (software): {panel.descartados}</p>
            </div>
          </div>
        </article>
      </div>

      <div className="panel-rejilla panel-rejilla-baja">
        <article className="tabla-caja">
          <div className="panel-titulo">
            <h2>Próximos a vencer</h2>
            <Link to="/tickets">Ver bandeja</Link>
          </div>
          {panel.proximos.length === 0 ? (
            <p>No hay casos por vencer en las próximas 48 horas.</p>
          ) : (
            <table className="tabla-sis">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Asunto</th>
                  <th>Nivel</th>
                  <th>Vence en</th>
                </tr>
              </thead>
              <tbody>
                {panel.proximos.map((fila) => (
                  <tr key={fila.numero}>
                    <td>
                      {fila.id ? <Link to={`/tickets/${fila.id}`}>{fila.numero}</Link> : fila.numero}
                    </td>
                    <td>{fila.titulo}</td>
                    <td>
                      <span className={claseNivel(fila.nivel)}>{fila.nivel}</span>
                    </td>
                    <td className={claseAns(fila.fechaObjetivoSolucion)}>
                      {restanteAns(fila.fechaObjetivoSolucion)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article className="panel-tarjeta panel-cta-ia">
          <h2>Agente IA · WhatsApp</h2>
          <p>El asistente atiende N1 y te avisa cuando necesita intervención humana.</p>
          <Button type="primary" icon={<RobotOutlined />} onClick={() => navigate('/agente')}>
            Abrir conversaciones
          </Button>
        </article>
      </div>
    </section>
  );
}
