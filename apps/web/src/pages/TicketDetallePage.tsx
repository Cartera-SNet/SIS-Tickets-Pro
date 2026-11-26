import { Button, Input, InputNumber, Modal } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { ErrorHttp, type Sesion, api } from '../api/http';
import { conectarTiempoReal } from '../api/tiempo-real';
import { claseAns, claseEstado, claseNivel, restanteAns } from '../ui/etiquetas';

type Adjunto = {
  id: string;
  nombre: string;
  tamano: number;
  mime?: string;
  subidoPorId?: string | null;
};

type Mensaje = {
  id: string;
  canal: string;
  autorTipo: string;
  autor: string;
  contenido: string;
  fecha: string;
  adjuntoId?: string | null;
  adjunto?: Adjunto | null;
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

function esImagenArchivo(adjunto: Pick<Adjunto, 'nombre' | 'mime'>) {
  return Boolean(adjunto.mime?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(adjunto.nombre));
}

function esPdfArchivo(adjunto: Pick<Adjunto, 'nombre' | 'mime'>) {
  return Boolean(adjunto.mime === 'application/pdf' || /\.pdf$/i.test(adjunto.nombre));
}

function tokenCsrf() {
  const coincidencia = document.cookie.match(/(?:^|; )sis_csrf=([^;]*)/);
  return coincidencia ? decodeURIComponent(coincidencia[1]) : null;
}

export function TicketDetallePage() {
  const { id = '' } = useParams();
  const sesion = useOutletContext<Sesion | null>();
  const [ticket, setTicket] = useState<Detalle | null>(null);
  const [aviso, setAviso] = useState('');
  const [texto, setTexto] = useState('');
  const [archivoRespuesta, setArchivoRespuesta] = useState<File | null>(null);
  const [calificacion, setCalificacion] = useState<number>(5);
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string; niveles: string[] }[]>([]);
  const socketRef = useRef<ReturnType<typeof conectarTiempoReal> | null>(null);
  const hiloRef = useRef<HTMLDivElement | null>(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [pestana, setPestana] = useState<'info' | 'hilo' | 'evidencias' | 'seguimiento'>('info');
  const [linea, setLinea] = useState<{ fecha: string; tipo: string; quien: string; detalle: unknown }[]>([]);
  const [visor, setVisor] = useState<Adjunto | null>(null);
  const [urlVisor, setUrlVisor] = useState('');
  const [errorVisor, setErrorVisor] = useState('');
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({});
  const [fallosMiniatura, setFallosMiniatura] = useState<Record<string, string>>({});
  const blobsRef = useRef<string[]>([]);
  const miniaturasPedidas = useRef<Set<string>>(new Set());

  function liberarBlobs(urls: string[]) {
    for (const url of urls) {
      URL.revokeObjectURL(url);
    }
  }

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
            adjuntos: [
              ...actual.adjuntos,
              { id: evento.id, nombre: evento.nombre, tamano: evento.tamano, mime: evento.mime, subidoPorId: evento.subidoPorId },
            ],
          };
        });
      },
    );
    return () => {
      socket.close();
    };
  }, [id]);

  useEffect(() => {
    if (pestana !== 'seguimiento' && pestana !== 'info') {
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

  useEffect(() => {
    return () => {
      liberarBlobs(blobsRef.current);
      blobsRef.current = [];
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    async function abrirVisor() {
      setErrorVisor('');
      setUrlVisor('');
      if (!visor || !ticket) {
        return;
      }
      try {
        const respuesta = await fetch(`/api/tickets/${ticket.id}/adjuntos/${visor.id}?ver=1`, {
          credentials: 'include',
        });
        if (!respuesta.ok) {
          let detalle = 'No se pudo abrir la evidencia.';
          try {
            const cuerpo = (await respuesta.json()) as { error?: { message?: string } };
            detalle = cuerpo.error?.message ?? detalle;
          } catch {
            /* ignore */
          }
          if (!cancelado) {
            setErrorVisor(detalle);
          }
          return;
        }
        const blob = await respuesta.blob();
        const url = URL.createObjectURL(blob);
        blobsRef.current.push(url);
        if (cancelado) {
          URL.revokeObjectURL(url);
          return;
        }
        setUrlVisor(url);
      } catch {
        if (!cancelado) {
          setErrorVisor('No se pudo abrir la evidencia.');
        }
      }
    }
    void abrirVisor();
    return () => {
      cancelado = true;
    };
  }, [visor, ticket?.id]);

  const idsAdjuntos = ticket?.adjuntos.map((item) => item.id).join(',') ?? '';

  useEffect(() => {
    if (!ticket || pestana !== 'evidencias') {
      return;
    }
    let cancelado = false;
    const pendientes = ticket.adjuntos.filter(
      (adjunto) => esImagenArchivo(adjunto) && !miniaturasPedidas.current.has(adjunto.id),
    );
    for (const adjunto of pendientes) {
      miniaturasPedidas.current.add(adjunto.id);
    }
    void (async () => {
      for (const adjunto of pendientes) {
        if (cancelado) {
          return;
        }
        try {
          const respuesta = await fetch(`/api/tickets/${ticket.id}/adjuntos/${adjunto.id}?ver=1`, {
            credentials: 'include',
          });
          if (!respuesta.ok) {
            let detalle = 'Archivo no disponible';
            try {
              const cuerpo = (await respuesta.json()) as { error?: { message?: string } };
              detalle = cuerpo.error?.message ?? detalle;
            } catch {
              /* ignore */
            }
            if (!cancelado) {
              setFallosMiniatura((actual) => ({ ...actual, [adjunto.id]: detalle }));
            }
            continue;
          }
          const blob = await respuesta.blob();
          const url = URL.createObjectURL(blob);
          blobsRef.current.push(url);
          if (cancelado) {
            URL.revokeObjectURL(url);
            return;
          }
          setMiniaturas((actual) => ({ ...actual, [adjunto.id]: url }));
        } catch {
          if (!cancelado) {
            setFallosMiniatura((actual) => ({ ...actual, [adjunto.id]: 'Archivo no disponible' }));
          }
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [idsAdjuntos, pestana, ticket]);

  async function enviarMensaje() {
    const contenido = texto.trim();
    const archivo = archivoRespuesta;
    const soyDuenio = Boolean(sesion?.id && ticket?.solicitante.id === sesion.id);
    const comoEquipo = sesion?.rol === 'TECNICO' || sesion?.rol === 'ADMINISTRADOR';
    if (!contenido && !(archivo && soyDuenio)) {
      return;
    }
    setTexto('');
    setArchivoRespuesta(null);
    try {
      if (archivo && comoEquipo) {
        if (!contenido) {
          throw new ErrorHttp(400, 'Escribe la respuesta al solicitante para adjuntar la evidencia.');
        }
        const datos = new FormData();
        datos.append('archivo', archivo);
        datos.append('mensaje', contenido);
        const csrf = tokenCsrf();
        const respuesta = await fetch(`/api/tickets/${id}/adjuntos`, {
          method: 'POST',
          credentials: 'include',
          headers: csrf ? { 'x-csrf-token': csrf } : {},
          body: datos,
        });
        if (!respuesta.ok) {
          const cuerpo = (await respuesta.json()) as { error?: { message?: string } };
          throw new ErrorHttp(respuesta.status, cuerpo.error?.message ?? 'No se pudo enviar la respuesta con evidencia.');
        }
        const cuerpo = (await respuesta.json()) as Adjunto & { mensaje?: Mensaje };
        setTicket((actual) => {
          if (!actual) {
            return actual;
          }
          const adjuntos = actual.adjuntos.some((item) => item.id === cuerpo.id)
            ? actual.adjuntos
            : [...actual.adjuntos, { id: cuerpo.id, nombre: cuerpo.nombre, tamano: cuerpo.tamano, mime: cuerpo.mime, subidoPorId: cuerpo.subidoPorId }];
          const mensajes =
            cuerpo.mensaje && !actual.mensajes.some((item) => item.id === cuerpo.mensaje?.id)
              ? [...actual.mensajes, cuerpo.mensaje]
              : actual.mensajes;
          return { ...actual, adjuntos, mensajes };
        });
        return;
      }
      if (archivo && soyDuenio) {
        await subirEvidenciaSolicitante(archivo);
      }
      if (!contenido) {
        return;
      }
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
      setArchivoRespuesta(archivo);
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo enviar el mensaje.');
    }
  }

  async function subirEvidenciaSolicitante(archivo: File) {
    const datos = new FormData();
    datos.append('archivo', archivo);
    const csrf = tokenCsrf();
    const respuesta = await fetch(`/api/tickets/${id}/adjuntos`, {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'x-csrf-token': csrf } : {},
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

  const ticketId = ticket.id;
  const esMio = sesion?.id === ticket.solicitante.id;
  const esEquipo = sesion?.rol === 'TECNICO' || sesion?.rol === 'ADMINISTRADOR';
  const esTecnico = esEquipo || Boolean(sesion?.permisos?.includes('tickets.ver_sede'));
  const puedeAdjuntarRespuesta = esEquipo || Boolean(sesion?.permisos?.includes('tickets.resolver'));
  const prioridadAlta =
    (ticket.prioridad?.nombre ?? '').toLowerCase().includes('alta') ||
    (ticket.prioridad?.nombre ?? '').toLowerCase().includes('crítica') ||
    (ticket.prioridad?.nombre ?? '').toLowerCase().includes('critica');

  function urlEvidencia(adjuntoId: string, ver = false) {
    return `/api/tickets/${ticketId}/adjuntos/${adjuntoId}${ver ? '?ver=1' : ''}`;
  }

  function etiquetaAutor(mensaje: Mensaje) {
    if (mensaje.autorTipo === 'AGENTE_IA') {
      return <span className="chip chip-ia">Agente IA</span>;
    }
    if (mensaje.autorTipo === 'TECNICO' || mensaje.autorTipo === 'SISTEMA') {
      return (
        <>
          <span className="chip chip-info">Soporte</span> {mensaje.autor}
        </>
      );
    }
    return mensaje.autor;
  }

  function burbuja(mensaje: Mensaje) {
    const delSoporte =
      mensaje.autorTipo === 'TECNICO' || mensaje.autorTipo === 'AGENTE_IA' || mensaje.autorTipo === 'SISTEMA';
    const adjunto = mensaje.adjunto;
    return (
      <div className={`hilo-msg ${delSoporte ? 'salida' : 'entrada'}`} key={mensaje.id}>
        <header>
          <strong>
            {etiquetaAutor(mensaje)}
            {mensaje.canal === 'WHATSAPP' ? ' · WhatsApp' : ''}
          </strong>
          <time>
            {new Date(mensaje.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </time>
        </header>
        <div>{mensaje.contenido}</div>
        {adjunto && (
          <button type="button" className="hilo-adjunto" onClick={() => setVisor(adjunto)}>
            Evidencia: {adjunto.nombre}
          </button>
        )}
      </div>
    );
  }

  function composer() {
    const puedeAdjuntarChat = puedeAdjuntarRespuesta || esMio;
    return (
      <div className={`hilo-composer ${puedeAdjuntarChat ? 'hilo-composer-equipo' : ''}`}>
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
          placeholder={
            puedeAdjuntarRespuesta
              ? 'Escribe la respuesta al solicitante…'
              : 'Escribe un mensaje o adjunta una evidencia del problema…'
          }
        />
        <div className="hilo-composer-barra">
          {puedeAdjuntarChat ? (
            <label className="boton-archivo">
              {archivoRespuesta ? `Archivo: ${archivoRespuesta.name}` : 'Adjuntar evidencia'}
              <input
                type="file"
                aria-label="Adjuntar evidencia"
                accept=".png,.jpg,.jpeg,.pdf,.txt,.webp"
                onChange={(evento) => {
                  setArchivoRespuesta(evento.target.files?.[0] ?? null);
                  evento.target.value = '';
                }}
              />
            </label>
          ) : null}
          <Button
            type="primary"
            onClick={() => void enviarMensaje()}
            disabled={!texto.trim() && !(esMio && archivoRespuesta)}
          >
            {puedeAdjuntarRespuesta ? 'Enviar respuesta' : 'Enviar'}
          </Button>
        </div>
        {archivoRespuesta && (
          <button type="button" className="hilo-quitar-archivo" onClick={() => setArchivoRespuesta(null)}>
            Quitar archivo adjunto
          </button>
        )}
      </div>
    );
  }

  function tarjetaSeguimiento() {
    const mensajesSoporte = ticket.mensajes.filter(
      (mensaje) => mensaje.autorTipo === 'TECNICO' || mensaje.autorTipo === 'AGENTE_IA',
    );
    const ultimoSoporte = mensajesSoporte[mensajesSoporte.length - 1];
    return (
      <article className="panel-tarjeta seguimiento-tarjeta">
        <h2>{esMio ? 'Seguimiento de tu caso' : 'Seguimiento'}</h2>
        <div className="dato-fila">
          <span>Quién atiende</span>
          <span>{ticket.responsable?.nombre ?? 'Aún sin asignar'}</span>
        </div>
        <div className="dato-fila">
          <span>Estado</span>
          <span>
            {ticket.estadoNombre} · Nivel {ticket.nivel.replace('N', '')}
          </span>
        </div>
        <div className="dato-fila">
          <span>Última respuesta de soporte</span>
          <span>
            {ultimoSoporte
              ? `${ultimoSoporte.autor}: ${ultimoSoporte.contenido}`
              : 'Soporte aún no ha respondido en el chat'}
          </span>
        </div>
        {ticket.fechaObjetivoSolucion && (
          <div className="dato-fila">
            <span>ANS</span>
            <span>Vence en {restanteAns(ticket.fechaObjetivoSolucion)}</span>
          </div>
        )}
        <div className="seguimiento-acciones">
          <Button type="primary" onClick={() => setPestana('hilo')}>
            Ver conversación
          </Button>
          <Button onClick={() => setPestana('seguimiento')}>Ver historial</Button>
        </div>
      </article>
    );
  }

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
            ['seguimiento', esMio ? 'Seguimiento' : 'Historial'],
          ] as const
        ).map(([clave, etiqueta]) => (
          <Button key={clave} type={pestana === clave ? 'primary' : 'default'} onClick={() => setPestana(clave)}>
            {etiqueta}
          </Button>
        ))}
      </div>

      {pestana === 'info' && (
        <div className="detalle-dos">
          {tarjetaSeguimiento()}
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
            {esMio ? (
              <>
                <label className="boton-archivo">
                  Adjuntar evidencia
                  <input
                    type="file"
                    aria-label="Evidencia"
                    accept=".png,.jpg,.jpeg,.pdf,.txt,.webp"
                    onChange={(evento) => {
                      const archivo = evento.target.files?.[0];
                      if (archivo) void subirEvidenciaSolicitante(archivo);
                      evento.target.value = '';
                    }}
                  />
                </label>
                <p>Fotos, capturas o PDF del caso. Ábrelas en el visor o elimínalas si te equivocaste.</p>
              </>
            ) : (
              <p>
                Aquí ves las evidencias del caso. Si eres del equipo, adjunta archivos solo al{' '}
                <button type="button" className="enlace-inline" onClick={() => setPestana('hilo')}>
                  responder en Conversación
                </button>
                .
              </p>
            )}
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
                    {esImagenArchivo(adjunto) && miniaturas[adjunto.id] ? (
                      <img src={miniaturas[adjunto.id]} alt="" />
                    ) : esImagenArchivo(adjunto) && fallosMiniatura[adjunto.id] ? (
                      <span className="evidencia-pdf-badge">SIN ARCHIVO</span>
                    ) : esPdfArchivo(adjunto) ? (
                      <span className="evidencia-pdf-badge">PDF</span>
                    ) : (
                      <span className="evidencia-pdf-badge">ARCHIVO</span>
                    )}
                  </button>
                  <strong title={adjunto.nombre}>{adjunto.nombre}</strong>
                  <span>{Math.max(1, Math.round(adjunto.tamano / 1024))} KB</span>
                  {fallosMiniatura[adjunto.id] && (
                    <span className="evidencia-aviso" title={fallosMiniatura[adjunto.id]}>
                      Archivo no disponible en el servidor
                    </span>
                  )}
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

      {pestana === 'seguimiento' && (
        <div className="detalle-dos">
          {tarjetaSeguimiento()}
          <article className="panel-tarjeta">
            <h2>{esMio ? 'Historial de tu caso' : 'Historial'}</h2>
            <p className="seguimiento-intro">
              {esMio
                ? 'Aquí ves qué ha hecho el equipo de soporte con tu solicitud: asignación, cambios de estado y respuestas.'
                : 'Registro auditable de estados, responsables y movimientos del ticket.'}
            </p>
            <ol className="linea-tiempo">
              {linea.map((fila, indice) => (
                <li key={`${fila.fecha}-${indice}`}>
                  <time>{new Date(fila.fecha).toLocaleString('es-CO')}</time>
                  <strong>{fila.tipo}</strong>
                  <span>{fila.quien}</span>
                </li>
              ))}
              {ticket.mensajes
                .filter((mensaje) => mensaje.autorTipo === 'TECNICO' || mensaje.autorTipo === 'AGENTE_IA')
                .map((mensaje) => (
                  <li key={`msg-${mensaje.id}`}>
                    <time>{new Date(mensaje.fecha).toLocaleString('es-CO')}</time>
                    <strong>Respuesta de soporte</strong>
                    <span>
                      {mensaje.autor}: {mensaje.contenido}
                    </span>
                  </li>
                ))}
              {linea.length === 0 && ticket.mensajes.every((mensaje) => mensaje.autorTipo === 'USUARIO') && (
                <li className="sin-punto">Todavía no hay movimientos de soporte.</li>
              )}
            </ol>
          </article>
        </div>
      )}

      <Modal
        open={Boolean(visor)}
        title={visor?.nombre ?? 'Evidencia'}
        onCancel={() => setVisor(null)}
        footer={[
          <Button key="cerrar" onClick={() => setVisor(null)}>
            Cerrar
          </Button>,
          visor && !errorVisor ? (
            <a key="descargar" href={urlEvidencia(visor.id)} download={visor.nombre}>
              <Button>Descargar</Button>
            </a>
          ) : null,
        ]}
        width={960}
        destroyOnClose
        className="modal-visor-evidencia"
      >
        {errorVisor && <p className="aviso-db">{errorVisor}</p>}
        {!errorVisor && !urlVisor && <p>Cargando evidencia…</p>}
        {visor && esImagen && urlVisor && <img className="visor-evidencia" src={urlVisor} alt={visor.nombre} />}
        {visor && esPdf && urlVisor && <iframe className="visor-evidencia-pdf" title={visor.nombre} src={urlVisor} />}
        {visor && !esImagen && !esPdf && !errorVisor && urlVisor && (
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
