import { Button, Input, InputNumber } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { ErrorHttp, type Sesion, api } from '../api/http';
import { conectarTiempoReal } from '../api/tiempo-real';

type Detalle = {
  id: string;
  numero: string;
  titulo: string;
  descripcion: string;
  estado: string;
  estadoNombre: string;
  nivel: string;
  porVencer: boolean;
  fechaObjetivoSolucion: string | null;
  solucionAplicada: string | null;
  solicitante: { id: string; nombre: string };
  prioridad: { nombre: string } | null;
  sede: { nombre: string } | null;
  ubicacion: { nombre: string } | null;
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

  if (!ticket) {
    return <p>{aviso || 'Cargando el caso…'}</p>;
  }

  const esMio = sesion?.id === ticket.solicitante.id;

  return (
    <section>
      <h1>
        {ticket.numero} · {ticket.titulo}
      </h1>
      <p>
        {ticket.estadoNombre} · {ticket.nivel} · {ticket.prioridad?.nombre ?? 'Sin prioridad'}
        {ticket.fechaObjetivoSolucion ? ` · vence ${new Date(ticket.fechaObjetivoSolucion).toLocaleString('es-CO')}` : ''}
      </p>
      {ticket.porVencer && <p className="aviso-db">Este caso está por vencer.</p>}
      {aviso && <p className="aviso-db">{aviso}</p>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['info', 'hilo', 'evidencias', 'historial'] as const).map((item) => (
          <Button key={item} type={pestana === item ? 'primary' : 'default'} onClick={() => setPestana(item)}>
            {item === 'info' ? 'Información' : item === 'hilo' ? 'Conversación' : item === 'evidencias' ? 'Evidencias' : 'Historial'}
          </Button>
        ))}
      </div>
      {pestana === 'info' && (
        <div>
          <p>{ticket.descripcion}</p>
          <p>
            {ticket.sede?.nombre} · {ticket.ubicacion?.nombre} · solicitante {ticket.solicitante.nombre}
          </p>
          {ticket.solucionAplicada && <p>Solución: {ticket.solucionAplicada}</p>}
          {sesion?.permisos.includes('tickets.escalar') && (
            <form
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
                  .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo escalar.'));
              }}
            >
              <h2>Escalar o devolver</h2>
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
              <Input name="motivo" placeholder="Motivo" required />
              <Input name="acciones" placeholder="Acciones ya hechas" required />
              <Button htmlType="submit">Registrar</Button>
            </form>
          )}
          {esMio && ticket.estado === 'RESUELTO' && (
            <div>
              <p>¿Quedó resuelto? Si no confirmas en 24 horas, el caso se reabre. No genera acta.</p>
              <InputNumber min={1} max={5} value={calificacion} onChange={(valor) => setCalificacion(Number(valor ?? 5))} />
              <Button type="primary" onClick={() => confirmar(true)}>
                Confirmar y calificar
              </Button>
              <Button onClick={() => confirmar(false)}>No quedó resuelto</Button>
            </div>
          )}
        </div>
      )}
      {pestana === 'hilo' && (
        <div>
          <ul>
            {ticket.mensajes.map((mensaje) => (
              <li key={mensaje.id}>
                {mensaje.canal} · {mensaje.autor} ({mensaje.autorTipo}): {mensaje.contenido}
              </li>
            ))}
          </ul>
          {escribiendo && <p>Alguien está escribiendo…</p>}
          <Input.TextArea
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
              socketRef.current?.emit('escribiendo', id);
            }}
            rows={3}
          />
          <Button type="primary" onClick={enviarMensaje} disabled={!texto.trim()}>
            Enviar
          </Button>
        </div>
      )}
      {pestana === 'evidencias' && (
        <div>
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
        </div>
      )}
      {pestana === 'historial' && (
        <ul>
          {linea.map((fila, indice) => (
            <li key={`${fila.fecha}-${indice}`}>
              {new Date(fila.fecha).toLocaleString('es-CO')} · {fila.tipo} · {fila.quien}
            </li>
          ))}
          {linea.length === 0 && <li>Sin movimientos todavía.</li>}
        </ul>
      )}
    </section>
  );
}
