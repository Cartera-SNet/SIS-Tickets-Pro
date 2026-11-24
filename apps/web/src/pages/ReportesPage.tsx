import { useEffect, useState } from 'react';
import { ErrorHttp, api } from '../api/http';

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
    return <p>{aviso || 'Cargando reportes…'}</p>;
  }

  return (
    <section>
      <h1>Reportes de servicio</h1>
      <p>Sin exportación. Los números salen de los casos registrados.</p>
      <ul>
        {resumen.porNivel.map((fila) => (
          <li key={fila.nivel}>
            {fila.nivel}: {fila.total}
          </li>
        ))}
      </ul>
      <p>Satisfacción promedio: {Number(resumen.satisfaccion).toFixed(1)} ({resumen.calificaciones} calificaciones)</p>
      <p>Horas promedio hasta resuelto: {resumen.promedioHoras}</p>
      <p>
        Cumplimiento de ANS: {resumen.cumplimientoAns}% ({resumen.casosConMeta} casos con meta)
      </p>
      <p>Atenciones del agente: {resumen.atencionesAgente}. Marcadas resueltas por IA: {resumen.resueltosPorIa}</p>
      <h2>Equipos con más casos</h2>
      <ul>
        {resumen.equipos.map((equipo) => (
          <li key={equipo.equipoId ?? 'sin'}>{equipo.total} casos</li>
        ))}
      </ul>
    </section>
  );
}
