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
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se pudieron ver las conversaciones.'));
  }

  useEffect(() => {
    cargar();
  }, []);

  const activa = filas.find((fila) => fila.id === activaId) ?? null;
  const guias = activa?.pasos.filter((paso) => paso === 'guiar').length ?? 0;
  const software = activa?.pasos.includes('software') ?? false;
  const burbujas = activa && activa.hilo.length > 0
    ? activa.hilo
    : activa
      ? [{ id: 'decision', lado: 'agente' as const, texto: DECISION[activa.decision] ?? 'Turno del agente registrado.', fecha: activa.fecha }]
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
      <h1>Conversación en curso · agente IA</h1>
      <p>Vista del analista: el agente atiende y el equipo puede intervenir.</p>
      {aviso && <p className="aviso-db">{aviso}</p>}
      <div className="agente-elegir" aria-label="Conversaciones">
        {filas.map((fila) => (
          <Button key={fila.id} type={fila.id === activaId ? 'primary' : 'default'} onClick={() => setActivaId(fila.id)}>
            {fila.usuario}
            {fila.transferencia ? ' · espera' : ''}
          </Button>
        ))}
      </div>
      {!activa && <p>No hay conversaciones del agente.</p>}
      {activa && (
        <div className="agente-sala">
          <div className="telefono" aria-label="Chat del solicitante">
            <div className="telefono-cabeza">
              <strong>Mesa de Ayuda TI</strong>
              <small>Asistente virtual · cuenta empresarial</small>
            </div>
            <div className="telefono-hilo">
              {burbujas.map((burbuja) => (
                <div key={burbuja.id} className={`burbuja ${burbuja.lado}`}>
                  {burbuja.texto}
                  <time>{new Date(burbuja.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
              ))}
              {guias > 0 && (
                <div className="telefono-opciones" aria-hidden="true">
                  <span>Sí, ya funciona</span>
                  <span>No, sigue igual</span>
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
                <strong className={software ? 'chip aviso' : 'chip ok'}>{software ? 'Sí · fuera de alcance' : 'No · dentro de alcance'}</strong>
              </div>
              <div className="agente-fila">
                <span>Pasos guiados</span>
                <strong>
                  {activa.articuloCodigo ? `${activa.articuloCodigo} · ` : ''}
                  {guias} intento{guias === 1 ? '' : 's'}
                  {activa.articulo ? ` · ${activa.articulo}` : ''}
                </strong>
              </div>
              <div className="agente-fila">
                <span>Confianza de clasificación</span>
                <strong>{activa.confianza == null ? '—' : Number(activa.confianza).toFixed(2)}</strong>
              </div>
              <div className="agente-fila">
                <span>Decisión</span>
                <strong className="chip aviso">{DECISION[activa.decision] ?? activa.decision}</strong>
              </div>
            </section>
            <section className="agente-caja">
              <h2>Acciones del analista</h2>
              <div className="agente-acciones">
                <Button disabled={!activa.transferencia} onClick={tomar}>
                  Tomar conversación
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
              <p>Toda la conversación queda guardada en el historial del ticket.</p>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
