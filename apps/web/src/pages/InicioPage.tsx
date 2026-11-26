import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorHttp, api } from '../api/http';
import { conectarTiempoReal } from '../api/tiempo-real';
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

export function InicioPage() {
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
    const socket = conectarTiempoReal();
    socket.on('connect', cargar);
    socket.on('notificacion', cargar);
    return () => {
      socket.close();
    };
  }, []);

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
        <div className="pagina-cabecera">
          <div>
            <h1>Mesa de ayuda TI</h1>
            <p>Tus casos están en Tickets.</p>
          </div>
        </div>
        {aviso && <p className="aviso-db">{aviso}</p>}
      </section>
    );
  }

  const conic = dona
    .map((parte) => `${parte.color} ${parte.inicio}% ${parte.inicio + parte.porcentaje}%`)
    .join(', ');

  return (
    <section>
      <div className="pagina-cabecera">
        <div>
          <h1>Panel principal</h1>
          <p>Indicadores en vivo de la mesa de ayuda.</p>
        </div>
      </div>

      <div className="kpis">
        <article className="kpi">
          <span>Abiertos</span>
          <strong>{panel.abiertos}</strong>
        </article>
        <article className="kpi morado">
          <span>Resueltos por IA hoy</span>
          <strong>{panel.resueltosPorIaHoy}</strong>
        </article>
        <article className="kpi ambar">
          <span>En N2 / N3</span>
          <strong>{panel.enN2N3}</strong>
        </article>
        <article className="kpi azul">
          <span>Actas pendientes de firma</span>
          <strong>{panel.actasPendientes}</strong>
        </article>
        <article className="kpi verde">
          <span>Preventivos del mes</span>
          <strong>{panel.preventivos.porcentaje}%</strong>
        </article>
      </div>

      <div className="panel-rejilla">
        <article className="panel-tarjeta">
          <h2>Tickets por categoría · 30 días</h2>
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
          <h2>Distribución por nivel</h2>
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

      <article className="tabla-caja">
        <h2>Próximos a vencer</h2>
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
    </section>
  );
}
