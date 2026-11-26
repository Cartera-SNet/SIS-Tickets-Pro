import { Button, Input, InputNumber } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { ErrorHttp, type Sesion, api } from '../api/http';
import { conectarTiempoReal } from '../api/tiempo-real';
import { claseAns, claseEstado, claseNivel, restanteAns } from '../ui/etiquetas';

type Detalle = {
  id: string;
  numero: string;
  titulo: string;
  descripcion: string;
  estado: string;
  estadoNombre: string;
  nivel: string;
  canal?: string;
  porVencer: boolean;
  fechaObjetivoSolucion: string | null;
  solucionAplicada: string | null;
  solicitante: { id: string; nombre: string };
  prioridad: { nombre: string } | null;
  sede: { nombre: string } | null;
  ubicacion: { nombre: string; piso?: string | null } | null;
  categoria?: { nombre: string } | null;
  equipo?: { placa?: string | null; nombre?: string | null } | null;
  responsable?: { nombre: string } | null;
  mensajes: { id: string; canal: string; autorTipo: string; autor: string; contenido: string; fecha: string }[];
  adjuntos: { id: string; nombre: string; tamano: number }[];
  historial: { id: string; tipo: string; fecha: string; datosNuevos: unknown }[];
};

export function TicketDetallePage() {
  const { id = '' } = useParams();
  const sesion = useOutletContext<Sesion | null>();
  const [ticket, setTicket] = useState<Detalle | null>(null);
  const [aviso, setAviso] = useState('');
  const [texto, setTexto] = useState('');
  const [calificacion, setCalificacion] = useState<number>(5);
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string; niveles: string[] }[]>([]);
  const socketRef = useRef<ReturnType<typeof conectarTiempoReal> | null>(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [pestana, setPestana] = useState<'info' | 'hilo' | 'evidencias' | 'historial'>('info');
  const [linea, setLinea] = useState<{ fecha: string; tipo: string; quien: string; detalle: unknown }[]>([]);

  function cargar() {
    api<Detalle>(`/api/tickets/${id}`)
      .then(setTicket)
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se encontró el caso.'));
  }

  useEffect(() => {
    cargar();
    if (sesion?.permisos.includes('tickets.escalar') || sesion?.permisos.includes('tickets.asignar')) {
      api<{ tecnicos: { id: string; nombre: string; niveles: string[] }[] }>('/api/tickets/asignacion/carga')
        .then((cuerpo) => setTecnicos(cuerpo.tecnicos))
        .catch(() => setTecnicos([]));
    }
  }, [id]);

  useEffect(() => {
    const socket = conectarTiempoReal();
    socketRef.current = socket;
    socket.emit('ticket:unirse', id);
    socket.on('escribiendo', () => {
      setEscribiendo(true);
      window.setTimeout(() => setEscribiendo(false), 2000);
    });
    return () => {
      socket.close();
    };
  }, [id]);

  useEffect(() => {
    if (pestana !== 'historial') {
      return;
    }
    api<{ linea: { fecha: string; tipo: string; quien: string; detalle: unknown }[] }>(`/api/auditoria/tickets/${id}`)
      .then((cuerpo) => setLinea(cuerpo.linea))
      .catch(() => setLinea([]));
  }, [pestana, id]);

  async function enviarMensaje() {
    await api(`/api/tickets/${id}/mensajes`, { method: 'POST', body: { contenido: texto } });
    setTexto('');
    cargar();
  }

  async function subir(archivo: File) {
    const datos = new FormData();
    datos.append('archivo', archivo);
    const csrf = document.cookie.match(/(?:^|; )sis_csrf=([^;]*)/)?.[1];
    const respuesta = await fetch(`/api/tickets/${id}/adjuntos`, {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {},
      body: datos,
    });
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json()) as { error?: { message?: string } };
      setAviso(cuerpo.error?.message ?? 'No se pudo adjuntar.');
      return;
    }
    cargar();
  }

  async function confirmar(acepta: boolean) {
    try {
      await api(`/api/tickets/${id}/confirmacion`, {
        method: 'POST',
        body: { confirmar: acepta, calificacion: acepta ? calificacion : undefined },
      });
      cargar();
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo confirmar.');
    }
  }

  async function marcarResuelto() {
    const solucion = window.prompt('Describe la solución aplicada');
    if (!solucion?.trim()) {
      return;
    }
    try {
      await api(`/api/tickets/${id}/estado`, {
        method: 'POST',
        body: { estado: 'RESUELTO', solucionAplicada: solucion },
      });
      cargar();
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo marcar resuelto.');
    }
  }

  if (!ticket) {
    return <p>{aviso || 'Cargando el caso…'}</p>;
  }

  const esMio = sesion?.id === ticket.solicitante.id;
  const prioridadAlta = (ticket.prioridad?.nombre ?? '').toLowerCase().includes('alta')
    || (ticket.prioridad?.nombre ?? '').toLowerCase().includes('crítica')
    || (ticket.prioridad?.nombre ?? '').toLowerCase().includes('critica');

  return (
    <section>
      <div className="detalle-cabecera">
        <div>
          <h1>
            {ticket.numero} · {ticket.titulo}
          </h1>
          <p>
            {ticket.canal === 'WHATSAPP' ? 'Creado por WhatsApp' : 'Creado por la web'}
            {ticket.fechaObjetivoSolucion
              ? ` · ANS de solución: vence en ${restanteAns(ticket.fechaObjetivoSolucion)}`
              : ''}
          </p>
          <div className="detalle-chips">
            <span className={claseNivel(ticket.nivel)}>{ticket.nivel}</span>
            <span className={claseEstado(ticket.estado)}>{ticket.estadoNombre}</span>
            {ticket.prioridad && (
              <span className={prioridadAlta ? 'chip chip-peligro' : 'chip chip-info'}>
                {ticket.prioridad.nombre}
              </span>
            )}
          </div>
          {ticket.fechaObjetivoSolucion && (
            <p className={claseAns(ticket.fechaObjetivoSolucion)}>
              {ticket.porVencer ? 'Este caso está por vencer.' : `Objetivo: ${new Date(ticket.fechaObjetivoSolucion).toLocaleString('es-CO')}`}
            </p>
          )}
        </div>
        <div className="detalle-acciones">
          {sesion?.permisos.includes('tickets.escalar') && (
            <Button onClick={() => setPestana('info')}>Escalar</Button>
          )}
          {sesion?.permisos.includes('tickets.resolver') && ticket.estado !== 'RESUELTO' && (
            <Button type="primary" onClick={() => void marcarResuelto()}>
              Marcar resuelto
            </Button>
          )}
        </div>
      </div>

      {aviso && <p className="aviso-db">{aviso}</p>}

      <div className="pestanas">
        {([
          ['info', 'Información'],
          ['hilo', 'Conversación'],
          ['evidencias', `Evidencias (${ticket.adjuntos.length})`],
          ['historial', 'Historial'],
        ] as const).map(([clave, etiqueta]) => (
          <Button
            key={clave}
            type={pestana === clave ? 'primary' : 'default'}
            onClick={() => setPestana(clave)}
          >
            {etiqueta}
          </Button>
        ))}
      </div>

      {pestana === 'info' && (
        <div className="detalle-dos">
          <article className="panel-tarjeta">
            <h2>Datos generales</h2>
            <div className="dato-fila">
              <span>Solicitante</span>
              <span>{ticket.solicitante.nombre}</span>
            </div>
            <div className="dato-fila">
              <span>Ubicación</span>
              <span>
                {[ticket.sede?.nombre, ticket.ubicacion?.piso ? `Piso ${ticket.ubicacion.piso}` : null, ticket.ubicacion?.nombre]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </span>
            </div>
            <div className="dato-fila">
              <span>Categoría</span>
              <span>{ticket.categoria?.nombre ?? '—'}</span>
            </div>
            <div className="dato-fila">
              <span>Equipo</span>
              <span>
                {[ticket.equipo?.placa, ticket.equipo?.nombre].filter(Boolean).join(' · ') || '—'}
              </span>
            </div>
            <div className="dato-fila">
              <span>Responsable</span>
              <span>{ticket.responsable?.nombre ?? 'Sin asignar'}</span>
            </div>
            <div className="dato-fila">
              <span>Descripción</span>
              <span>{ticket.descripcion}</span>
            </div>
            {ticket.solucionAplicada && (
              <div className="dato-fila">
                <span>Solución</span>
                <span>{ticket.solucionAplicada}</span>
              </div>
            )}
          </article>

          <article className="panel-tarjeta">
            <h2>Conversación en vivo</h2>
            <div className="hilo-vivo">
              {ticket.mensajes.slice(-6).map((mensaje) => (
                <div className="hilo-msg" key={mensaje.id}>
                  <header>
                    <strong>
                      {mensaje.autorTipo === 'AGENTE_IA' ? (
                        <span className="chip chip-ia">Agente IA</span>
                      ) : (
                        mensaje.autor
                      )}
                    </strong>
                    <time>{new Date(mensaje.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</time>
                  </header>
                  <div>{mensaje.contenido}</div>
                </div>
              ))}
              {ticket.mensajes.length === 0 && <p>Sin mensajes todavía.</p>}
              {escribiendo && <p>Alguien está escribiendo…</p>}
            </div>
            <div className="hilo-composer">
              <Input.TextArea
                value={texto}
                onChange={(evento) => {
                  setTexto(evento.target.value);
                  socketRef.current?.emit('escribiendo', id);
                }}
                rows={2}
                placeholder="Escribe un mensaje…"
              />
              <Button type="primary" onClick={enviarMensaje} disabled={!texto.trim()}>
                Enviar
              </Button>
            </div>
          </article>

          {sesion?.permisos.includes('tickets.escalar') && (
            <article className="panel-tarjeta" style={{ gridColumn: '1 / -1' }}>
              <h2>Escalar o devolver</h2>
              <form
                className="filtros-fila"
                onSubmit={(evento) => {
                  evento.preventDefault();
                  const datos = new FormData(evento.currentTarget);
                  void api(`/api/tickets/${id}/escalar`, {
                    method: 'POST',
                    body: {
                      nivelDestino: datos.get('nivel'),
                      motivo: datos.get('motivo'),
                      acciones: datos.get('acciones'),
                      responsableId: datos.get('responsable'),
                    },
                  })
                    .then(() => cargar())
                    .catch((error: unknown) =>
                      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo escalar.'),
                    );
                }}
              >
                <select name="nivel" aria-label="Nivel destino" defaultValue="N2">
                  <option value="N1">N1</option>
                  <option value="N2">N2</option>
                  <option value="N3">N3</option>
                </select>
                <select name="responsable" aria-label="Responsable" defaultValue={tecnicos[0]?.id}>
                  {tecnicos.map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>
                      {tecnico.nombre} · {tecnico.niveles.join(', ')}
                    </option>
                  ))}
                </select>
                <Input name="motivo" placeholder="Motivo" required style={{ minWidth: 180, flex: 1 }} />
                <Input name="acciones" placeholder="Acciones ya hechas" required style={{ minWidth: 180, flex: 1 }} />
                <Button htmlType="submit" type="primary">
                  Registrar
                </Button>
              </form>
            </article>
          )}

          {esMio && ticket.estado === 'RESUELTO' && (
            <article className="panel-tarjeta" style={{ gridColumn: '1 / -1' }}>
              <h2>Validación del solicitante</h2>
              <p>¿Quedó resuelto? Si no confirmas en 24 horas, el caso se reabre. No genera acta.</p>
              <div className="filtros-fila">
                <InputNumber min={1} max={5} value={calificacion} onChange={(valor) => setCalificacion(Number(valor ?? 5))} />
                <Button type="primary" onClick={() => confirmar(true)}>
                  Confirmar y calificar
                </Button>
                <Button onClick={() => confirmar(false)}>No quedó resuelto</Button>
              </div>
            </article>
          )}
        </div>
      )}

      {pestana === 'hilo' && (
        <article className="panel-tarjeta">
          <div className="hilo-vivo" style={{ maxHeight: 560 }}>
            {ticket.mensajes.map((mensaje) => (
              <div className="hilo-msg" key={mensaje.id}>
                <header>
                  <strong>
                    {mensaje.canal} · {mensaje.autor} ({mensaje.autorTipo})
                  </strong>
                  <time>{new Date(mensaje.fecha).toLocaleString('es-CO')}</time>
                </header>
                <div>{mensaje.contenido}</div>
              </div>
            ))}
          </div>
          {escribiendo && <p>Alguien está escribiendo…</p>}
          <div className="hilo-composer">
            <Input.TextArea
              value={texto}
              onChange={(evento) => {
                setTexto(evento.target.value);
                socketRef.current?.emit('escribiendo', id);
              }}
              rows={3}
              placeholder="Escribe un mensaje (también puede llegar al WhatsApp del solicitante)…"
            />
            <Button type="primary" onClick={enviarMensaje} disabled={!texto.trim()}>
              Enviar
            </Button>
          </div>
        </article>
      )}

      {pestana === 'evidencias' && (
        <article className="panel-tarjeta">
          <input
            type="file"
            aria-label="Evidencia"
            onChange={(evento) => {
              const archivo = evento.target.files?.[0];
              if (archivo) void subir(archivo);
            }}
          />
          <ul>
            {ticket.adjuntos.map((adjunto) => (
              <li key={adjunto.id}>
                <a href={`/api/tickets/${ticket.id}/adjuntos/${adjunto.id}`}>{adjunto.nombre}</a> · {adjunto.tamano} bytes
              </li>
            ))}
          </ul>
          {ticket.adjuntos.length === 0 && <p>Sin evidencias todavía.</p>}
        </article>
      )}

      {pestana === 'historial' && (
        <article className="panel-tarjeta">
          <ul>
            {linea.map((fila, indice) => (
              <li key={`${fila.fecha}-${indice}`}>
                {new Date(fila.fecha).toLocaleString('es-CO')} · {fila.tipo} · {fila.quien}
              </li>
            ))}
            {linea.length === 0 && <li>Sin movimientos todavía.</li>}
          </ul>
        </article>
      )}
    </section>
  );
}
