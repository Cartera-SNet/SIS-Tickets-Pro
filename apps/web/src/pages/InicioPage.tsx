import { useEffect, useState } from 'react';
import { ErrorHttp, api } from '../api/http';
import { conectarTiempoReal } from '../api/tiempo-real';

type Panel = {
  abiertos: number;
  resueltosPorIaHoy: number;
  enN2N3: number;
  actasPendientes: number;
  preventivos: { porcentaje: number; programadas: number; conActa: number };
  porCategoria: { categoria: string; total: number }[];
  porNivel: { nivel: string; total: number }[];
  descartados: number;
  proximos: { numero: string; titulo: string; nivel: string; fechaObjetivoSolucion: string }[];
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

  if (!panel) {
    return (
      <section>
        <h1>Mesa de ayuda TI</h1>
        <p>Tus casos están en Tickets.</p>
        {aviso && <p className="aviso-db">{aviso}</p>}
      </section>
    );
  }

  return (
    <section>
      <h1>Panel</h1>
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
          <span>En N2 o N3</span>
          <strong>{panel.enN2N3}</strong>
        </article>
        <article className="kpi azul">
          <span>Actas pendientes</span>
          <strong>{panel.actasPendientes}</strong>
        </article>
        <article className="kpi verde">
          <span>Preventivos del mes</span>
          <strong>{panel.preventivos.porcentaje}%</strong>
        </article>
      </div>
      <h2>Por categoría, 30 días</h2>
      <ul>
        {panel.porCategoria.map((fila) => (
          <li key={fila.categoria}>
            {fila.categoria}: {fila.total}
          </li>
        ))}
      </ul>
      <h2>Por nivel</h2>
      <ul>
        {panel.porNivel.map((fila) => (
          <li key={fila.nivel}>
            {fila.nivel}: {fila.total}
          </li>
        ))}
      </ul>
      <p>Descartados por software: {panel.descartados}</p>
      <h2>Próximos a vencer</h2>
      <ul>
        {panel.proximos.map((fila) => (
          <li key={fila.numero}>
            {fila.numero} · {fila.titulo} · {fila.nivel} · {new Date(fila.fechaObjetivoSolucion).toLocaleString('es-CO')}
          </li>
        ))}
      </ul>
      {panel.proximos.length === 0 && <p>No hay casos por vencer en las próximas 48 horas.</p>}
    </section>
  );
}
