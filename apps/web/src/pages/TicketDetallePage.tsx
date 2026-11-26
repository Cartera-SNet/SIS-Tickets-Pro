import { Button, Input, InputNumber, Modal } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { ErrorHttp, type Sesion, api } from '../api/http';
import { conectarTiempoReal } from '../api/tiempo-real';
import { claseAns, claseEstado, claseNivel, restanteAns } from '../ui/etiquetas';

type Mensaje = {
  id: string;
  canal: string;
  autorTipo: string;
  autor: string;
  contenido: string;
  fecha: string;
};

type Adjunto = {
  id: string;
  nombre: string;
  tamano: number;
  mime?: string;
  subidoPorId?: string | null;
};

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
  subcategoria?: { nombre: string } | null;
  equipo?: { placa?: string | null; nombre?: string | null } | null;
  responsable?: { nombre: string } | null;
  mensajes: Mensaje[];
  adjuntos: Adjunto[];
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
  const hiloRef = useRef<HTMLDivElement | null>(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [pestana, setPestana] = useState<'info' | 'hilo' | 'evidencias' | 'historial'>('info');
  const [linea, setLinea] = useState<{ fecha: string; tipo: string; quien: string; detalle: unknown }[]>([]);
  const [visor, setVisor] = useState<Adjunto | null>(null);

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
    socket.on('ticket:mensaje', (mensaje: Mensaje & { ticketId?: string }) => {
      if (mensaje.ticketId && mensaje.ticketId !== id) {
        return;
      }
      setTicket((actual) => {
        if (!actual) {
          return actual;
        }
        if (actual.mensajes.some((item) => item.id === mensaje.id)) {
          return actual;
        }
        return { ...actual, mensajes: [...actual.mensajes, mensaje] };
      });
    });
    socket.on(
      'ticket:adjunto',
      (evento: Adjunto & { ticketId?: string; accion: 'agregado' | 'eliminado' }) => {
        if (evento.ticketId && evento.ticketId !== id) {
          return;
        }
        setTicket((actual) => {
          if (!actual) {
            return actual;
          }
          if (evento.accion === 'eliminado') {
            return { ...actual, adjuntos: actual.adjuntos.filter((item) => item.id !== evento.id) };
          }
          if (actual.adjuntos.some((item) => item.id === evento.id)) {
            return actual;
          }
          return {
            ...actual,
            adjuntos: [...actual.adjuntos, { id: evento.id, nombre: evento.nombre, tamano: evento.tamano, mime: evento.mime }],
          };
        });
      },
    );
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

  useEffect(() => {
    const caja = hiloRef.current;
    if (caja) {
      caja.scrollTop = caja.scrollHeight;
    }
  }, [ticket?.mensajes.length, pestana]);

  async function enviarMensaje() {
    const contenido = texto.trim();
    if (!contenido) {
      return;
    }
    setTexto('');
    try {
      const mensaje = await api<Mensaje>(`/api/tickets/${id}/mensajes`, {
        method: 'POST',
        body: { contenido },
      });
      setTicket((actual) => {
        if (!actual) {
          return actual;
        }
        if (actual.mensajes.some((item) => item.id === mensaje.id)) {
          return actual;
        }
        return { ...actual, mensajes: [...actual.mensajes, mensaje] };
      });
    } catch (error) {
      setTexto(contenido);
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo enviar el mensaje.');
    }
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
    const adjunto = (await respuesta.json()) as Adjunto;
    setTicket((actual) => {
      if (!actual) {
        return actual;
      }
      if (actual.adjuntos.some((item) => item.id === adjunto.id)) {
        return actual;
      }
      return { ...actual, adjuntos: [...actual.adjuntos, adjunto] };
    });
  }

  async function eliminarEvidencia(adjuntoId: string) {
    try {
      await api(`/api/tickets/${id}/adjuntos/${adjuntoId}`, { method: 'DELETE' });
      setTicket((actual) =>
        actual ? { ...actual, adjuntos: actual.adjuntos.filter((item) => item.id !== adjuntoId) } : actual,
      );
      if (visor?.id === adjuntoId) {
        setVisor(null);
      }
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo eliminar la evidencia.');
    }
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
  const esTecnico =
    sesion?.rol === 'TECNICO' ||
    sesion?.rol === 'ADMINISTRADOR' ||
    Boolean(sesion?.permisos?.includes('tickets.ver_sede'));
  const prioridadAlta =
    (ticket.prioridad?.nombre ?? '').toLowerCase().includes('alta') ||
    (ticket.prioridad?.nombre ?? '').toLowerCase().includes('crítica') ||
    (ticket.prioridad?.nombre ?? '').toLowerCase().includes('critica');

  function esImagenArchivo(adjunto: Adjunto) {
    return Boolean(adjunto.mime?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(adjunto.nombre));
  }

  function esPdfArchivo(adjunto: Adjunto) {
    return Boolean(adjunto.mime === 'application/pdf' || /\.pdf$/i.test(adjunto.nombre));
  }

  function urlEvidencia(adjuntoId: string, ver = false) {
    return `/api/tickets/${ticket.id}/adjuntos/${adjuntoId}${ver ? '?ver=1' : ''}`;
  }

  function burbuja(mensaje: Mensaje) {
    const propio =
      mensaje.autorTipo === 'TECNICO' || mensaje.autorTipo === 'AGENTE_IA' || mensaje.autorTipo === 'SISTEMA';
    return (
      <div className={`hilo-msg ${propio ? 'salida' : 'entrada'}`} key={mensaje.id}>
        <header>
          <strong>
            {mensaje.autorTipo === 'AGENTE_IA' ? <span className="chip chip-ia">Agente IA</span> : mensaje.autor}
            {mensaje.canal === 'WHATSAPP' ? ' · WhatsApp' : ''}
          </strong>
          <time>
            {new Date(mensaje.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </time>
        </header>
        <div>{mensaje.contenido}</div>
      </div>
    );
  }

  function composer() {
    return (
      <div className="hilo-composer">
        <Input.TextArea
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            socketRef.current?.emit('escribiendo', id);
          }}
          onPressEnter={(evento) => {
            if (!evento.shiftKey) {
              evento.preventDefault();
              void enviarMensaje();
            }
          }}
          rows={2}
          placeholder="Escribe un mensaje (también llega al WhatsApp del solicitante)…"
        />
        <Button type="primary" onClick={() => void enviarMensaje()} disabled={!texto.trim()}>
          Enviar
        </Button>
      </div>
    );
  }

  const urlVisor = visor ? urlEvidencia(visor.id, true) : '';
  const esImagen = visor ? esImagenArchivo(visor) : false;
  const esPdf = visor ? esPdfArchivo(visor) : false;

  return (
    <section>
      <div className="detalle-cabecera">
        <div>
          <h1>
            {ticket.numero} · {ticket.titulo}
          </h1>
          <p>
            {ticket.canal === 'WHATSAPP' ? 'Creado por WhatsApp' : 'Creado por la web'}
            {ticket.mensajes[0] ? ` · ${new Date(ticket.mensajes[0].fecha).toLocaleString('es-CO')}` : ''}
          </p>
          <div className="detalle-chips">
            <span className={claseNivel(ticket.nivel)}>Nivel {ticket.nivel.replace('N', '')}</span>
            <span className={claseEstado(ticket.estado)}>{ticket.estadoNombre}</span>
            {ticket.prioridad && (
              <span className={prioridadAlta ? 'chip chip-peligro' : 'chip chip-info'}>{ticket.prioridad.nombre}</span>
            )}
            {ticket.fechaObjetivoSolucion && (
              <span className={`chip ans-badge ${claseAns(ticket.fechaObjetivoSolucion)}`}>
                ANS · vence en {restanteAns(ticket.fechaObjetivoSolucion)}
              </span>
            )}
          </div>
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
        {(
          [
            ['info', 'Información'],
            ['hilo', 'Conversación'],
            ['evidencias', `Evidencias (${ticket.adjuntos.length})`],
            ['historial', 'Historial'],
          ] as const
        ).map(([clave, etiqueta]) => (
          <Button key={clave} type={pestana === clave ? 'primary' : 'default'} onClick={() => setPestana(clave)}>
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
              <span>
                {[ticket.categoria?.nombre, ticket.subcategoria?.nombre].filter(Boolean).join(' · ') || '—'}
              </span>
            </div>
            <div className="dato-fila">
              <span>Equipo</span>
              <span>{[ticket.equipo?.placa, ticket.equipo?.nombre].filter(Boolean).join(' · ') || '—'}</span>
            </div>
            <div className="dato-fila">
              <span>Responsable</span>
              <span>{ticket.responsable?.nombre ?? 'Sin asignar'}</span>
            </div>
            <div className="dato-fila">
              <span>Canal de origen</span>
              <span>{ticket.canal === 'WHATSAPP' ? 'WhatsApp · agente IA' : 'Web'}</span>
            </div>
            <div className="dato-fila">
              <span>Descripción</span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{ticket.descripcion}</span>
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
            <div className="hilo-vivo" ref={hiloRef}>
              {ticket.mensajes.slice(-8).map(burbuja)}
              {ticket.mensajes.length === 0 && <p>Sin mensajes todavía.</p>}
              {escribiendo && <p className="hilo-escribiendo">Alguien está escribiendo…</p>}
            </div>
            {composer()}
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
              <p>¿Quedó resuelto? Si no confirmas en 24 horas, el caso se reabre.</p>
              <div className="filtros-fila">
                <InputNumber min={1} max={5} value={calificacion} onChange={(valor) => setCalificacion(Number(valor ?? 5))} />
                <Button type="primary" onClick={() => void confirmar(true)}>
                  Confirmar y calificar
                </Button>
                <Button onClick={() => void confirmar(false)}>No quedó resuelto</Button>
              </div>
            </article>
          )}
        </div>
      )}

      {pestana === 'hilo' && (
        <article className="panel-tarjeta chat-panel">
          <div className="hilo-vivo hilo-completo" ref={hiloRef}>
            {ticket.mensajes.map(burbuja)}
            {ticket.mensajes.length === 0 && <p>Sin mensajes todavía.</p>}
            {escribiendo && <p className="hilo-escribiendo">Alguien está escribiendo…</p>}
          </div>
          {composer()}
        </article>
      )}

      {pestana === 'evidencias' && (
        <article className="panel-tarjeta">
          <div className="evidencias-subir">
            <label className="boton-archivo">
              Adjuntar evidencia
              <input
                type="file"
                aria-label="Evidencia"
                accept=".png,.jpg,.jpeg,.pdf,.txt,.webp"
                onChange={(evento) => {
                  const archivo = evento.target.files?.[0];
                  if (archivo) void subir(archivo);
                  evento.target.value = '';
                }}
              />
            </label>
            <p>Fotos, capturas o PDF del caso. Ábrelas en el visor o elimínalas si te equivocaste.</p>
          </div>
          <div className="evidencias-rejilla">
            {ticket.adjuntos.map((adjunto) => {
              const puedeBorrar =
                esTecnico || adjunto.subidoPorId === sesion?.id || ticket.solicitante.id === sesion?.id;
              const previsualizable = esImagenArchivo(adjunto) || esPdfArchivo(adjunto);
              return (
                <div className="evidencia-card" key={adjunto.id}>
                  <button
                    type="button"
                    className="evidencia-preview"
                    onClick={() => setVisor(adjunto)}
                    aria-label={`Ver ${adjunto.nombre}`}
                  >
                    {esImagenArchivo(adjunto) ? (
                      <img src={urlEvidencia(adjunto.id, true)} alt="" />
                    ) : esPdfArchivo(adjunto) ? (
                      <span className="evidencia-pdf-badge">PDF</span>
                    ) : (
                      <span className="evidencia-pdf-badge">ARCHIVO</span>
                    )}
                  </button>
                  <strong title={adjunto.nombre}>{adjunto.nombre}</strong>
                  <span>{Math.max(1, Math.round(adjunto.tamano / 1024))} KB</span>
                  <div className="evidencia-acciones">
                    <Button size="small" type="primary" onClick={() => setVisor(adjunto)}>
                      {previsualizable ? 'Ver' : 'Abrir'}
                    </Button>
                    <a href={urlEvidencia(adjunto.id)} download={adjunto.nombre}>
                      <Button size="small">Descargar</Button>
                    </a>
                    {puedeBorrar && (
                      <Button size="small" danger onClick={() => void eliminarEvidencia(adjunto.id)}>
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {ticket.adjuntos.length === 0 && <p>Sin evidencias todavía.</p>}
        </article>
      )}

      {pestana === 'historial' && (
        <article className="panel-tarjeta">
          <ol className="linea-tiempo">
            {linea.map((fila, indice) => (
              <li key={`${fila.fecha}-${indice}`}>
                <time>{new Date(fila.fecha).toLocaleString('es-CO')}</time>
                <strong>{fila.tipo}</strong>
                <span>{fila.quien}</span>
              </li>
            ))}
            {linea.length === 0 && <li className="sin-punto">Sin movimientos todavía.</li>}
          </ol>
        </article>
      )}

      <Modal
        open={Boolean(visor)}
        title={visor?.nombre ?? 'Evidencia'}
        onCancel={() => setVisor(null)}
        footer={[
          <Button key="cerrar" onClick={() => setVisor(null)}>
            Cerrar
          </Button>,
          visor ? (
            <a key="descargar" href={urlEvidencia(visor.id)} download={visor.nombre}>
              <Button>Descargar</Button>
            </a>
          ) : null,
        ]}
        width={960}
        destroyOnClose
        className="modal-visor-evidencia"
      >
        {visor && esImagen && <img className="visor-evidencia" src={urlVisor} alt={visor.nombre} />}
        {visor && esPdf && <iframe className="visor-evidencia-pdf" title={visor.nombre} src={urlVisor} />}
        {visor && !esImagen && !esPdf && (
          <p>
            Este tipo de archivo no tiene vista previa.{' '}
            <a href={urlEvidencia(visor.id)} download={visor.nombre}>
              Descárgalo aquí
            </a>
            .
          </p>
        )}
      </Modal>
    </section>
  );
}
