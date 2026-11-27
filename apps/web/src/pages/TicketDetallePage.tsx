import { Button, Input, InputNumber, Modal, Select } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { consultarEvidenciaBase64, descargarEvidenciaBase64, subirEvidenciaBase64 } from '../api/evidencias';
import { ErrorHttp, type Sesion, api } from '../api/http';
import { conectarTiempoReal } from '../api/tiempo-real';
import { claseAns, claseEstado, claseNivel, restanteAns } from '../ui/etiquetas';
import { useToasts } from '../ui/Toasts';

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
  fechaCreacion?: string;
  fechaObjetivoSolucion: string | null;
  fechaResolucion?: string | null;
  fechaCierre?: string | null;
  solucionAplicada: string | null;
  solicitante: { id: string; nombre: string };
  prioridad: { nombre: string } | null;
  sede: { nombre: string } | null;
  ubicacion: { nombre: string; piso?: string | null } | null;
  categoria?: { nombre: string } | null;
  subcategoria?: { nombre: string } | null;
  equipo?: { placa?: string | null; nombre?: string | null; serial?: string | null } | null;
  equipoNombre?: string | null;
  equipoSerial?: string | null;
  responsable?: { id?: string; nombre: string } | null;
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

export function TicketDetallePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const sesion = useOutletContext<Sesion | null>();
  const { mostrar } = useToasts();
  const [ticket, setTicket] = useState<Detalle | null>(null);
  const [aviso, setAviso] = useState('');
  const [texto, setTexto] = useState('');
  const [archivoRespuesta, setArchivoRespuesta] = useState<File | null>(null);
  const [calificacion, setCalificacion] = useState<number>(5);
  const [comentarioRechazo, setComentarioRechazo] = useState('');
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string; niveles: string[] }[]>([]);
  const socketRef = useRef<ReturnType<typeof conectarTiempoReal> | null>(null);
  const hiloRef = useRef<HTMLDivElement | null>(null);
  const pestanaRef = useRef<'info' | 'hilo' | 'evidencias' | 'seguimiento'>('info');
  const [escribiendo, setEscribiendo] = useState(false);
  const [pestana, setPestana] = useState<'info' | 'hilo' | 'evidencias' | 'seguimiento'>('info');
  const [linea, setLinea] = useState<{ fecha: string; tipo: string; quien: string; detalle: unknown }[]>([]);
  const [visor, setVisor] = useState<Adjunto | null>(null);
  const [urlVisor, setUrlVisor] = useState('');
  const [errorVisor, setErrorVisor] = useState('');
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({});
  const [fallosMiniatura, setFallosMiniatura] = useState<Record<string, string>>({});
  const miniaturasPedidas = useRef<Set<string>>(new Set());
  const [escalaNivel, setEscalaNivel] = useState('N2');
  const [escalaMotivo, setEscalaMotivo] = useState('');
  const [escalaAcciones, setEscalaAcciones] = useState('');
  const [escalaResponsable, setEscalaResponsable] = useState('');
  const [actaDiagnostico, setActaDiagnostico] = useState('');
  const [actaActividades, setActaActividades] = useState('');
  const [actaEstadoFinal, setActaEstadoFinal] = useState('Operativo');
  const [generandoActa, setGenerandoActa] = useState(false);
  pestanaRef.current = pestana;

  function cargar() {
    api<Detalle>(`/api/tickets/${id}`)
      .then((detalle) => {
        setTicket(detalle);
        if (!actaDiagnostico) {
          setActaDiagnostico(detalle.descripcion);
        }
        if (!actaActividades && detalle.solucionAplicada) {
          setActaActividades(detalle.solucionAplicada);
        }
      })
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se encontró el caso.'));
  }

  useEffect(() => {
    cargar();
    if (sesion?.permisos.includes('tickets.escalar') || sesion?.permisos.includes('tickets.asignar')) {
      api<{ tecnicos: { id: string; nombre: string; niveles: string[] }[] }>('/api/tickets/asignacion/carga')
        .then((cuerpo) => {
          setTecnicos(cuerpo.tecnicos);
          setEscalaResponsable((actual) => actual || cuerpo.tecnicos[0]?.id || '');
        })
        .catch(() => setTecnicos([]));
    }
  }, [id]);

  useEffect(() => {
    const socket = conectarTiempoReal();
    socketRef.current = socket;
    const unirse = () => socket.emit('ticket:unirse', id);
    unirse();
    socket.on('connect', unirse);
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
      const chatEnFoco = pestanaRef.current === 'hilo' && document.visibilityState === 'visible';
      if (!chatEnFoco && mensaje.autorTipo !== 'USUARIO') {
        mostrar({
          titulo: `Mensaje · ${mensaje.autor}`,
          cuerpo: mensaje.contenido.slice(0, 120),
          href: `/tickets/${id}`,
        });
      }
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
    socket.on(
      'ticket:estado',
      (evento: { ticketId?: string; estado?: string; estadoNombre?: string; nivel?: string; responsableId?: string }) => {
        if (evento.ticketId && evento.ticketId !== id) {
          return;
        }
        setTicket((actual) => {
          if (!actual) {
            return actual;
          }
          return {
            ...actual,
            estado: evento.estado ?? actual.estado,
            estadoNombre: evento.estadoNombre ?? actual.estadoNombre,
            nivel: evento.nivel ?? actual.nivel,
          };
        });
        cargar();
      },
    );
    return () => {
      socket.off('connect', unirse);
      socket.close();
    };
  }, [id, mostrar]);

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
    let cancelado = false;
    async function abrirVisor() {
      setErrorVisor('');
      setUrlVisor('');
      if (!visor || !ticket) {
        return;
      }
      try {
        const evidencia = await consultarEvidenciaBase64(ticket.id, visor.id);
        if (cancelado) {
          return;
        }
        setUrlVisor(evidencia.dataUrl);
      } catch (error) {
        if (!cancelado) {
          setErrorVisor(error instanceof ErrorHttp ? error.message : 'No se pudo abrir la evidencia.');
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
          const evidencia = await consultarEvidenciaBase64(ticket.id, adjunto.id);
          if (cancelado) {
            return;
          }
          setMiniaturas((actual) => ({ ...actual, [adjunto.id]: evidencia.dataUrl }));
        } catch (error) {
          if (!cancelado) {
            setFallosMiniatura((actual) => ({
              ...actual,
              [adjunto.id]: error instanceof ErrorHttp ? error.message : 'Archivo no disponible',
            }));
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
        const cuerpo = (await subirEvidenciaBase64(id, archivo, contenido)) as Adjunto & { mensaje?: Mensaje };
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
    try {
      const adjunto = (await subirEvidenciaBase64(id, archivo)) as Adjunto;
      setTicket((actual) => {
        if (!actual) {
          return actual;
        }
        if (actual.adjuntos.some((item) => item.id === adjunto.id)) {
          return actual;
        }
        return { ...actual, adjuntos: [...actual.adjuntos, adjunto] };
      });
      miniaturasPedidas.current.delete(adjunto.id);
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo adjuntar.');
    }
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
      if (!acepta && comentarioRechazo.trim().length < 4) {
        setAviso('Indica por qué la solicitud aún no está solucionada.');
        return;
      }
      await api(`/api/tickets/${id}/confirmacion`, {
        method: 'POST',
        body: {
          confirmar: acepta,
          calificacion: acepta ? calificacion : undefined,
          comentario: acepta ? undefined : comentarioRechazo.trim(),
        },
      });
      setComentarioRechazo('');
      cargar();
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo confirmar.');
    }
  }

  async function marcarResuelto() {
    const solucion = window.prompt('Describe la solución aplicada para avisar al solicitante');
    if (!solucion?.trim()) {
      return;
    }
    try {
      await api(`/api/tickets/${id}/estado`, {
        method: 'POST',
        body: { estado: 'RESUELTO', solucionAplicada: solucion },
      });
      setActaActividades(solucion.trim());
      cargar();
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo avisar la solución.');
    }
  }

  async function registrarEscala() {
    if (!escalaMotivo.trim() || !escalaAcciones.trim()) {
      setAviso('Completa Motivo y Acción ya realizada para escalar.');
      return;
    }
    if (!escalaResponsable) {
      setAviso('Asigna un técnico o al administrador para escalar.');
      return;
    }
    const motivo = escalaMotivo.trim();
    const acciones = escalaAcciones.trim();
    const nivelDestino = ticket?.nivel === 'N2' ? 'N3' : escalaNivel;
    try {
      await api(`/api/tickets/${id}/escalar`, {
        method: 'POST',
        body: {
          nivelDestino,
          motivo,
          acciones,
          responsableId: escalaResponsable,
        },
      });
      setEscalaMotivo('');
      setEscalaAcciones('');
      setActaDiagnostico((actual) => actual || motivo);
      setActaActividades((actual) => actual || acciones);
      cargar();
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo escalar.');
    }
  }

  async function generarActaDesdeSeguimiento() {
    if (!ticket) {
      return;
    }
    const diagnostico = (actaDiagnostico || escalaMotivo || ticket.descripcion).trim();
    const actividades = (actaActividades || escalaAcciones || ticket.solucionAplicada || '').trim();
    if (diagnostico.length < 4 || actividades.length < 4) {
      setAviso('Completa motivo/diagnóstico y acciones realizadas antes de generar el acta.');
      setPestana('seguimiento');
      return;
    }
    setGenerandoActa(true);
    try {
      const acta = await api<{ id: string; numero: string }>('/api/actas', {
        method: 'POST',
        body: {
          ticketId: ticket.id,
          diagnostico,
          actividades,
          estadoFinal: actaEstadoFinal.trim() || 'Operativo',
          observaciones: `Evidencias: ${ticket.adjuntos.map((item) => item.nombre).join(', ') || 'ninguna'}`,
        },
      });
      mostrar({
        titulo: `Acta ${acta.numero} generada`,
        cuerpo: `Ticket ${ticket.numero}`,
        href: `/actas/${acta.id}`,
      });
      navigate(`/actas/${acta.id}`);
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo generar el acta.');
    } finally {
      setGenerandoActa(false);
    }
  }

  if (!ticket) {
    return <p>{aviso || 'Cargando el caso…'}</p>;
  }

  const ticketId = ticket.id;
  // Copia ya validada: dentro de funciones internas TypeScript pierde la comprobación de nulo.
  const ticketActual: Detalle = ticket;
  const esMio = sesion?.id === ticket.solicitante.id;
  const esEquipo = sesion?.rol === 'TECNICO' || sesion?.rol === 'ADMINISTRADOR';
  const esTecnico = esEquipo || Boolean(sesion?.permisos?.includes('tickets.ver_sede'));
  const puedeAdjuntarRespuesta = esEquipo || Boolean(sesion?.permisos?.includes('tickets.resolver'));
  const puedeEscalar = Boolean(sesion?.permisos.includes('tickets.escalar')) && ticket.nivel !== 'N3';
  const puedeActa = Boolean(sesion?.permisos.includes('actas.firmar')) && ticket.nivel !== 'N1';
  const nombreEquipo = ticket.equipoNombre || ticket.equipo?.placa || ticket.equipo?.nombre || '';
  const serialEquipo = ticket.equipoSerial || ticket.equipo?.serial || '';
  const etiquetaEquipo =
    !nombreEquipo && !serialEquipo
      ? '—'
      : [nombreEquipo, serialEquipo ? `Serial: ${serialEquipo}` : ''].filter(Boolean).join(' · ');
  const nivelesEscala =
    ticket.nivel === 'N1'
      ? [
          { value: 'N2', label: 'N2' },
          { value: 'N3', label: 'N3 (solo si el área está detenida)' },
        ]
      : ticket.nivel === 'N2'
        ? [{ value: 'N3', label: 'N3' }]
        : [];
  const nivelEscalaEfectivo = ticket.nivel === 'N2' ? 'N3' : escalaNivel;
  const tecnicosFiltrados = tecnicos.filter(
    (tecnico) => tecnico.niveles.includes(nivelEscalaEfectivo) || tecnico.nombre.includes('(Admin)'),
  );
  const prioridadAlta =
    (ticket.prioridad?.nombre ?? '').toLowerCase().includes('alta') ||
    (ticket.prioridad?.nombre ?? '').toLowerCase().includes('crítica') ||
    (ticket.prioridad?.nombre ?? '').toLowerCase().includes('critica');

  function descargarAdjunto(adjunto: Adjunto) {
    void descargarEvidenciaBase64(ticketId, adjunto.id, adjunto.nombre).catch((error: unknown) => {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo descargar la evidencia.');
    });
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
    const mensajesSoporte = ticketActual.mensajes.filter(
      (mensaje) => mensaje.autorTipo === 'TECNICO' || mensaje.autorTipo === 'AGENTE_IA',
    );
    const ultimoSoporte = mensajesSoporte[mensajesSoporte.length - 1];
    return (
      <article className="panel-tarjeta seguimiento-tarjeta">
        <h2>{esMio ? 'Seguimiento de tu caso' : 'Seguimiento'}</h2>
        <div className="dato-fila">
          <span>Quién atiende</span>
          <span>{ticketActual.responsable?.nombre ?? 'Aún sin asignar'}</span>
        </div>
        <div className="dato-fila">
          <span>Estado</span>
          <span>
            {ticketActual.estadoNombre} · Nivel {ticketActual.nivel.replace('N', '')}
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
        {ticketActual.fechaObjetivoSolucion && (
          <div className="dato-fila">
            <span>ANS</span>
            <span>Vence en {restanteAns(ticketActual.fechaObjetivoSolucion)}</span>
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
          {sesion?.permisos.includes('tickets.resolver') && ticket.estado !== 'RESUELTO' && ticket.estado !== 'CERRADO' && (
            <Button type="primary" onClick={() => void marcarResuelto()}>
              Avisar solución al solicitante
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
              <span>{etiquetaEquipo}</span>
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

          {puedeEscalar && nivelesEscala.length > 0 && (
            <article className="panel-tarjeta" style={{ gridColumn: '1 / -1' }}>
              <h2>Escalar</h2>
              <p>
                Solo se escala a un nivel superior. Debes asignar un técnico o al administrador; el caso no entra en
                atención hasta tener responsable.
              </p>
              <div className="filtros-fila" style={{ flexWrap: 'wrap' }}>
                <Select
                  aria-label="Nivel destino"
                  style={{ width: 220 }}
                  value={nivelEscalaEfectivo}
                  onChange={setEscalaNivel}
                  options={nivelesEscala}
                  disabled={ticket.nivel === 'N2'}
                />
                <Select
                  aria-label="Asignar a"
                  style={{ minWidth: 220, flex: 1 }}
                  value={escalaResponsable || undefined}
                  onChange={setEscalaResponsable}
                  placeholder="Asignar técnico o admin"
                  options={tecnicosFiltrados.map((tecnico) => ({
                    value: tecnico.id,
                    label: `${tecnico.nombre} · ${tecnico.niveles.join(', ')}`,
                  }))}
                />
                <Input
                  value={escalaMotivo}
                  onChange={(evento) => setEscalaMotivo(evento.target.value)}
                  placeholder="Motivo"
                  required
                  style={{ minWidth: 180, flex: 1 }}
                />
                <Input
                  value={escalaAcciones}
                  onChange={(evento) => setEscalaAcciones(evento.target.value)}
                  placeholder="Acción ya realizada"
                  required
                  style={{ minWidth: 180, flex: 1 }}
                />
                <Button
                  type="primary"
                  onClick={() => void registrarEscala()}
                  disabled={!escalaMotivo.trim() || !escalaAcciones.trim() || !escalaResponsable}
                >
                  Escalar y asignar
                </Button>
              </div>
            </article>
          )}

          {esMio && ticket.estado === 'RESUELTO' && (
            <article className="panel-tarjeta" style={{ gridColumn: '1 / -1' }}>
              <h2>Confirmación de la solución</h2>
              <p>
                El técnico indica que tu solicitud ya fue solucionada. Confirma para cerrar el caso, o indica que aún no
                lo está (se reabre con tu comentario). Si no respondes en 24 horas, el caso se cierra automáticamente.
              </p>
              <div className="filtros-fila" style={{ flexWrap: 'wrap' }}>
                <InputNumber min={1} max={5} value={calificacion} onChange={(valor) => setCalificacion(Number(valor ?? 5))} />
                <Button type="primary" onClick={() => void confirmar(true)}>
                  Confirmar solución
                </Button>
              </div>
              <Input.TextArea
                style={{ marginTop: 12 }}
                rows={2}
                value={comentarioRechazo}
                onChange={(evento) => setComentarioRechazo(evento.target.value)}
                placeholder="Si aún no está solucionada, escribe el motivo…"
              />
              <Button style={{ marginTop: 8 }} onClick={() => void confirmar(false)}>
                Aún no está solucionada
              </Button>
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
                    <Button size="small" onClick={() => descargarAdjunto(adjunto)}>
                      Descargar
                    </Button>
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
                ? 'Aquí ves qué ha hecho el equipo de soporte con tu solicitud: asignación, cambios de estado, evidencias y respuestas.'
                : 'Registro auditable de estados, responsables y movimientos del ticket.'}
            </p>
            {(esMio || esTecnico) && ticket.adjuntos.length > 0 && (
              <div className="seguimiento-evidencias">
                <strong>Evidencias de avance</strong>
                <ul>
                  {ticket.adjuntos.map((adjunto) => (
                    <li key={adjunto.id}>
                      <button type="button" className="enlace-inline" onClick={() => setVisor(adjunto)}>
                        {adjunto.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
          {puedeActa && (
            <article className="panel-tarjeta" style={{ gridColumn: '1 / -1' }}>
              <h2>Acta de cierre</h2>
              <p>
                Se precarga con el seguimiento del ticket {ticket.numero} (ID {ticket.id}). No reescribas datos ya
                registrados.
              </p>
              <div className="dato-fila">
                <span>Equipo</span>
                <span>{etiquetaEquipo}</span>
              </div>
              <div className="dato-fila">
                <span>Solicitante</span>
                <span>{ticket.solicitante.nombre}</span>
              </div>
              <div className="dato-fila">
                <span>Técnico</span>
                <span>{ticket.responsable?.nombre ?? 'Sin asignar'}</span>
              </div>
              <label>
                Motivo / diagnóstico
                <Input.TextArea
                  rows={2}
                  value={actaDiagnostico}
                  onChange={(evento) => setActaDiagnostico(evento.target.value)}
                />
              </label>
              <label>
                Acciones / solución aplicada
                <Input.TextArea
                  rows={2}
                  value={actaActividades}
                  onChange={(evento) => setActaActividades(evento.target.value)}
                />
              </label>
              <label>
                Estado final
                <Input value={actaEstadoFinal} onChange={(evento) => setActaEstadoFinal(evento.target.value)} />
              </label>
              <Button
                type="primary"
                loading={generandoActa}
                style={{ marginTop: 12 }}
                onClick={() => void generarActaDesdeSeguimiento()}
              >
                Generar acta desde seguimiento
              </Button>
            </article>
          )}
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
            <Button key="descargar" onClick={() => descargarAdjunto(visor)}>
              Descargar
            </Button>
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
            <button type="button" className="enlace-inline" onClick={() => descargarAdjunto(visor)}>
              Descárgalo aquí
            </button>
            .
          </p>
        )}
      </Modal>
    </section>
  );
}
