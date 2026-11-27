import { Button } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { ErrorHttp, api } from '../api/http';
import { useTiempoReal } from '../api/tiempo-real';

type Aviso = {
  id: string;
  titulo: string;
  cuerpo: string;
  fecha: string;
  evento?: string;
  entregas?: { canal: string; estado: string }[];
};

function hace(fecha: string): string {
  const ms = Date.now() - new Date(fecha).getTime();
  if (Number.isNaN(ms) || ms < 0) return 'ahora';
  const min = Math.round(ms / 60000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

function claseCanal(estado: string): string {
  const e = estado.toUpperCase();
  if (e.includes('FALL') || e.includes('ERROR')) return 'chip chip-peligro';
  if (e.includes('LEIDO') || e.includes('ENTREG')) return 'chip chip-ok';
  return 'chip chip-info';
}

export function NotificacionesPage() {
  const { on, conectado } = useTiempoReal();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'sin-leer'>('todas');
  const enVivo = conectado;

  function cargar() {
    api<Aviso[]>('/api/notificaciones')
      .then(setAvisos)
      .catch((fallo: unknown) => setError(fallo instanceof ErrorHttp ? fallo.message : 'No se cargaron los avisos.'));
  }

  useEffect(() => {
    cargar();
    const offPendientes = on('pendientes', (() => cargar()) as (...args: never[]) => void);
    const offNotificacion = on('notificacion', (() => cargar()) as (...args: never[]) => void);
    return () => {
      offPendientes();
      offNotificacion();
    };
  }, [on]);

  async function marcar(id: string) {
    await api(`/api/notificaciones/${id}/leida`, { method: 'POST' });
    cargar();
  }

  async function marcarTodas() {
    for (const aviso of avisos) {
      const leida = (aviso.entregas ?? []).some((e) => e.canal === 'WEB' && e.estado === 'LEIDO');
      if (!leida) {
        await api(`/api/notificaciones/${aviso.id}/leida`, { method: 'POST' });
      }
    }
    cargar();
  }

  const visibles = useMemo(() => {
    if (filtro === 'todas') return avisos;
    return avisos.filter((aviso) => !(aviso.entregas ?? []).some((e) => e.canal === 'WEB' && e.estado === 'LEIDO'));
  }, [avisos, filtro]);

  const sinLeer = avisos.filter((aviso) => !(aviso.entregas ?? []).some((e) => e.canal === 'WEB' && e.estado === 'LEIDO')).length;

  return (
    <section>
      <div className="pagina-cabecera">
        <div>
          <h1>Notificaciones</h1>
          <p>
            {sinLeer} sin leer · {enVivo ? 'llegan en vivo sin recargar la página' : 'reconectando…'}
          </p>
        </div>
        <Button onClick={() => void marcarTodas()} disabled={sinLeer === 0}>
          Marcar todas como leídas
        </Button>
      </div>

      <div className="pestanas" style={{ marginBottom: 12 }}>
        <Button type={filtro === 'todas' ? 'primary' : 'default'} onClick={() => setFiltro('todas')}>
          Todas
        </Button>
        <Button type={filtro === 'sin-leer' ? 'primary' : 'default'} onClick={() => setFiltro('sin-leer')}>
          Sin leer
        </Button>
      </div>

      {error && <p className="aviso-db">{error}</p>}

      <article className="tabla-caja">
        {visibles.length === 0 && <p>No tienes avisos.</p>}
        <div className="lista-avisos">
          {visibles.map((aviso) => {
            const leida = (aviso.entregas ?? []).some((e) => e.canal === 'WEB' && e.estado === 'LEIDO');
            return (
              <div key={aviso.id} className={`aviso-fila${leida ? '' : ' sin-leer'}`}>
                <span className="aviso-punto" aria-hidden="true" />
                <div>
                  <strong>{aviso.titulo}</strong>
                  <p style={{ margin: '4px 0 0' }}>{aviso.cuerpo}</p>
                </div>
                <span className="chip">{aviso.evento ?? 'aviso'}</span>
                <div className="aviso-canales">
                  {(aviso.entregas ?? [{ canal: 'WEB', estado: 'PENDIENTE' }]).map((entrega) => (
                    <span key={`${aviso.id}-${entrega.canal}`} className={claseCanal(entrega.estado)}>
                      {entrega.canal}
                    </span>
                  ))}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{hace(aviso.fecha)}</span>
                {!leida && (
                  <Button size="small" onClick={() => void marcar(aviso.id)}>
                    Marcar leída
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}
