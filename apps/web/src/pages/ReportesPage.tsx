import { useEffect, useState } from 'react';
import { ErrorHttp, api } from '../api/http';
import { claseNivel } from '../ui/etiquetas';

type Resumen = {
  porNivel: { nivel: string; total: number }[];
  satisfaccion: number;
  calificaciones: number;
  promedioHoras: number;
  cumplimientoAns: number;
  casosConMeta: number;
  atencionesAgente: number;
  resueltosPorIa: number;
  equipos: { equipoId: string | null; total: number }[];
};

export function ReportesPage() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    api<Resumen>('/api/reportes/servicio')
      .then(setResumen)
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se pudieron cargar los reportes.'));
  }, []);

  if (!resumen) {
    return (
      <section>
        <div className="pagina-cabecera">
          <div>
            <h1>Reportes de servicio</h1>
            <p>{aviso || 'Cargando indicadores…'}</p>
          </div>
        </div>
      </section>
    );
  }

  const maxNivel = Math.max(1, ...resumen.porNivel.map((fila) => fila.total));

  return (
    <section>
      <div className="pagina-cabecera">
        <div>
          <h1>Reportes de servicio</h1>
          <p>Resolución por IA, ANS, satisfacción y equipos con más incidencias. La exportación a Excel/PDF queda en reserva.</p>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <article className="kpi morado">
          <span>Resueltos por IA</span>
          <strong>{resumen.resueltosPorIa}</strong>
        </article>
        <article className="kpi verde">
          <span>Cumplimiento ANS</span>
          <strong>{resumen.cumplimientoAns}%</strong>
        </article>
        <article className="kpi ambar">
          <span>Satisfacción</span>
          <strong>{Number(resumen.satisfaccion).toFixed(1)}</strong>
        </article>
        <article className="kpi azul">
          <span>Horas promedio a resuelto</span>
          <strong>{resumen.promedioHoras}</strong>
        </article>
      </div>

      <div className="panel-rejilla">
        <article className="panel-tarjeta">
          <h2>Tickets por nivel</h2>
          {resumen.porNivel.map((fila) => (
            <div className="barra-cat" key={fila.nivel}>
              <span className={claseNivel(fila.nivel)}>{fila.nivel}</span>
              <div className="barra-pista" aria-hidden="true">
                <div className="barra-lleno" style={{ width: `${(fila.total / maxNivel) * 100}%` }} />
              </div>
              <strong>{fila.total}</strong>
            </div>
          ))}
          <p className="dona-nota">
            Atenciones del agente: {resumen.atencionesAgente} · Casos con meta ANS: {resumen.casosConMeta} · Calificaciones:{' '}
            {resumen.calificaciones}
          </p>
        </article>

        <article className="panel-tarjeta">
          <h2>Equipos con más casos</h2>
          <table className="tabla-sis">
            <thead>
              <tr>
                <th>#</th>
                <th>Equipo</th>
                <th>Casos</th>
              </tr>
            </thead>
            <tbody>
              {resumen.equipos.map((equipo, indice) => (
                <tr key={equipo.equipoId ?? `sin-${indice}`}>
                  <td>{indice + 1}</td>
                  <td>{equipo.equipoId ?? 'Sin equipo'}</td>
                  <td>{equipo.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {resumen.equipos.length === 0 && <p>Sin datos de equipos.</p>}
        </article>
      </div>
    </section>
  );
}
