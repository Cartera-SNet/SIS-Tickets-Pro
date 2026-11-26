import { Button } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorHttp, api } from '../api/http';

type Burbuja = { id: string; lado: 'usuario' | 'agente'; texto: string; fecha: string };

type Conversacion = {
  id: string;
  usuario: string;
  celularVerificado: boolean;
  confianza: number | null;
  transferencia: boolean;
  articulo: string | null;
  articuloCodigo: string | null;
  ticket: string | null;
  ticketId: string | null;
  categoria: string | null;
  pasos: string[];
  decision: string;
  fecha: string;
  hilo: Burbuja[];
};

const DECISION: Record<string, string> = {
  software: 'Descartar · es software',
  baja_confianza: 'Escalar a analista · confianza baja',
  guiar: 'Guiar con un artículo',
  crear_ticket: 'Crear ticket y escalar',
  resuelto_n1: 'Resuelto en N1',
  privacidad: 'Detener · privacidad',
  credencial: 'Detener · credencial',
  consultar_estado: 'Consultar el estado',
  tomada: 'Tomada por un analista',
};

export function AgentePage() {
  const [filas, setFilas] = useState<Conversacion[]>([]);
  const [activaId, setActivaId] = useState('');
  const [aviso, setAviso] = useState('');

  function cargar() {
    api<Conversacion[]>('/api/agente/conversaciones')
      .then((lista) => {
        setFilas(lista);
        setActivaId((actual) => actual || lista.find((fila) => fila.transferencia)?.id || lista[0]?.id || '');
      })
      .catch((error: unknown) =>
        setAviso(error instanceof ErrorHttp ? error.message : 'No se pudieron ver las conversaciones.'),
      );
  }

  useEffect(() => {
    cargar();
  }, []);

  const activa = filas.find((fila) => fila.id === activaId) ?? null;
  const guias = activa?.pasos.filter((paso) => paso === 'guiar').length ?? 0;
  const software = activa?.pasos.includes('software') ?? false;
  const confianzaPct =
    activa?.confianza == null ? null : Math.max(0, Math.min(100, Math.round(Number(activa.confianza) * 100)));
  const burbujas =
    activa && activa.hilo.length > 0
      ? activa.hilo
      : activa
        ? [
            {
              id: 'decision',
              lado: 'agente' as const,
              texto: DECISION[activa.decision] ?? 'Turno del agente registrado.',
              fecha: activa.fecha,
            },
          ]
        : [];

  async function tomar() {
    if (!activa) {
      return;
    }
    await api(`/api/agente/conversaciones/${activa.id}/tomar`, { method: 'POST' });
    cargar();
  }

  return (
    <section>
      <div className="pagina-cabecera">
        <div>
          <h1>Conversación en curso · agente IA</h1>
          <p>Vista del analista: el agente atiende por WhatsApp y el equipo puede intervenir.</p>
        </div>
        <span className="chip chip-ia">N1 · WhatsApp</span>
      </div>

      {aviso && <p className="aviso-db">{aviso}</p>}

      {filas.length === 0 && !aviso && (
        <div className="vacio-caja">
          <strong>No hay conversaciones del agente</strong>
          <p>Cuando un usuario escriba por WhatsApp, verás el hilo aquí.</p>
        </div>
      )}

      {filas.length > 0 && (
        <div className="agente-layout">
          <aside className="agente-lista" aria-label="Conversaciones">
            {filas.map((fila) => {
              const ultima = fila.hilo[fila.hilo.length - 1];
              return (
                <button
                  key={fila.id}
                  type="button"
                  className={`agente-lista-item${fila.id === activaId ? ' activa' : ''}`}
                  onClick={() => setActivaId(fila.id)}
                >
                  <div className="agente-lista-cabeza">
                    <strong>{fila.usuario}</strong>
                    {fila.transferencia && <span className="chip chip-aviso">Espera</span>}
                  </div>
                  <span className="agente-lista-preview">
                    {ultima?.texto ?? DECISION[fila.decision] ?? 'Sin mensajes'}
                  </span>
                  <time>{new Date(fila.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</time>
                </button>
              );
            })}
          </aside>

          {activa && (
            <>
              <div className="telefono" aria-label="Chat del solicitante">
                <div className="telefono-cabeza">
                  <div className="telefono-marca" aria-hidden="true">
                    S
                  </div>
                  <div>
                    <strong>Mesa de Ayuda TI</strong>
                    <small>Asistente virtual · cuenta empresarial</small>
                  </div>
                </div>
                <div className="telefono-hilo">
                  {burbujas.map((burbuja) => (
                    <div key={burbuja.id} className={`burbuja ${burbuja.lado}`}>
                      {burbuja.texto}
                      <time>
                        {new Date(burbuja.fecha).toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  ))}
                  {guias > 0 && (
                    <div className="telefono-opciones" aria-hidden="true">
                      <span>Sí, ya funciona</span>
                      <span className="opcion-activa">No, sigue igual</span>
                    </div>
                  )}
                </div>
                <div className="telefono-pie">
                  <input readOnly placeholder="Mensaje" aria-label="El solicitante escribe por WhatsApp" />
                </div>
              </div>

              <div className="agente-panel">
                <section className="agente-caja">
                  <h2>Análisis del agente</h2>
                  <div className="agente-fila">
                    <span>Usuario identificado</span>
                    <strong>
                      {activa.usuario} · {activa.celularVerificado ? 'celular verificado' : 'sin celular verificado'}
                    </strong>
                  </div>
                  <div className="agente-fila">
                    <span>Categoría detectada</span>
                    <strong>{activa.categoria ?? 'Sin categoría'}</strong>
                  </div>
                  <div className="agente-fila">
                    <span>¿Es solicitud de software?</span>
                    <strong className={software ? 'chip chip-peligro' : 'chip chip-ok'}>
                      {software ? 'Sí · fuera de alcance' : 'No · dentro de alcance'}
                    </strong>
                  </div>
                  <div className="agente-fila">
                    <span>Pasos guiados</span>
                    <strong>
                      {activa.articuloCodigo ? `${activa.articuloCodigo} · ` : ''}
                      {guias} intento{guias === 1 ? '' : 's'}
                      {activa.articulo ? ` · ${activa.articulo}` : ''}
                    </strong>
                  </div>
                  <div className="agente-fila agente-fila-confianza">
                    <span>Confianza de clasificación</span>
                    <div className="confianza-caja">
                      <strong>{confianzaPct == null ? '—' : `${(confianzaPct / 100).toFixed(2)}`}</strong>
                      {confianzaPct != null && (
                        <div className="confianza-pista" aria-hidden="true">
                          <div className="confianza-lleno" style={{ width: `${confianzaPct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="agente-fila">
                    <span>Decisión</span>
                    <strong className="chip chip-aviso">{DECISION[activa.decision] ?? activa.decision}</strong>
                  </div>
                </section>

                <section className="agente-caja">
                  <h2>Acciones del analista</h2>
                  <div className="agente-acciones">
                    <Button disabled={!activa.transferencia} onClick={() => void tomar()}>
                      Tomar la conversación
                    </Button>
                    {activa.ticketId ? (
                      <Link to={`/tickets/${activa.ticketId}`}>
                        <Button>Corregir categoría</Button>
                      </Link>
                    ) : (
                      <Button disabled>Corregir categoría</Button>
                    )}
                    {activa.ticketId ? (
                      <Link to={`/tickets/${activa.ticketId}`}>
                        <Button type="primary">Ver ticket {activa.ticket}</Button>
                      </Link>
                    ) : (
                      <Button type="primary" disabled>
                        Ver ticket
                      </Button>
                    )}
                  </div>
                  <p className="agente-nota">Toda la conversación queda guardada en el historial del ticket.</p>
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
