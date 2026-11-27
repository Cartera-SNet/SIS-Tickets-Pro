import {
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CloseOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  FileAddOutlined,
  InboxOutlined,
  RobotOutlined,
  SearchOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, Input, Layout, Menu } from 'antd';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { api, obtenerJson, type Sesion } from '../api/http';
import { conectarTiempoReal } from '../api/tiempo-real';
import { MarcaSis } from '../components/MarcaSis';
import { menuVisible, rutaPermitida } from '../navigation';
import { useToasts } from '../ui/Toasts';

const { Header, Sider, Content } = Layout;

const ICONOS: Record<string, ReactNode> = {
  '/': <DashboardOutlined />,
  '/tickets': <UnorderedListOutlined />,
  '/tickets/nuevo': <FileAddOutlined />,
  '/agente': <RobotOutlined />,
  '/preventivo': <CalendarOutlined />,
  '/actas': <FileDoneOutlined />,
  '/notificaciones': <BellOutlined />,
  '/conocimiento': <BookOutlined />,
  '/reportes': <InboxOutlined />,
  '/configuracion': <SettingOutlined />,
  '/manual': <QuestionCircleOutlined />,
};

const ETIQUETA_ROL: Record<string, string> = {
  SOLICITANTE: 'Solicitante',
  TECNICO: 'Técnico',
  ADMINISTRADOR: 'Administrador',
};

type BurbujaFab = { id: string; lado: 'usuario' | 'agente'; texto: string };

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const sesion = useOutletContext<Sesion | null>();
  const { mostrar } = useToasts();
  const [enVivo, setEnVivo] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [chatAbierto, setChatAbierto] = useState(false);
  const [textoAgente, setTextoAgente] = useState('');
  const [enviandoAgente, setEnviandoAgente] = useState(false);
  const [hiloAgente, setHiloAgente] = useState<BurbujaFab[]>([
    {
      id: 'bienvenida',
      lado: 'agente',
      texto: 'Hola. Cuéntame el problema del equipo, la red o una app básica (sin datos sensibles).',
    },
  ]);
  const chatAbiertoRef = useRef(false);
  const rutaRef = useRef(location.pathname);
  chatAbiertoRef.current = chatAbierto;
  rutaRef.current = location.pathname;

  const iniciales = (sesion?.nombre ?? 'IN')
    .split(' ')
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();
  const esMesa = sesion?.rol === 'TECNICO' || sesion?.rol === 'ADMINISTRADOR';

  useEffect(() => {
    let activo = true;
    const consultar = () => {
      obtenerJson<{ estado: string }>('/health')
        .then((cuerpo) => {
          if (activo) {
            setEnVivo(cuerpo.estado === 'ok');
          }
        })
        .catch(() => {
          if (activo) {
            setEnVivo(false);
          }
        });
    };
    consultar();
    const reloj = window.setInterval(consultar, 15000);
    return () => {
      activo = false;
      window.clearInterval(reloj);
    };
  }, []);

  useEffect(() => {
    if (!sesion?.id) {
      return;
    }
    const socket = conectarTiempoReal();
    const onMensaje = (payload: { ticketId?: string; autor?: string; contenido?: string; autorTipo?: string }) => {
      const ticketId = payload.ticketId;
      if (!ticketId) {
        return;
      }
      const enEsteTicket = rutaRef.current === `/tickets/${ticketId}`;
      const chatTicketFoco = enEsteTicket && document.visibilityState === 'visible';
      if (chatTicketFoco || chatAbiertoRef.current) {
        return;
      }
      if (payload.autorTipo === 'USUARIO' && !esMesa) {
        return;
      }
      mostrar({
        titulo: `Mensaje · ${payload.autor ?? 'Chat'}`,
        cuerpo: payload.contenido?.slice(0, 120) ?? 'Nuevo mensaje',
        href: `/tickets/${ticketId}`,
      });
    };
    const onAsignado = (payload: { ticketId?: string; numero?: string }) => {
      if (!payload.ticketId) {
        return;
      }
      mostrar({
        titulo: `${payload.numero ?? 'Ticket'} asignado`,
        cuerpo: 'Te asignaron un caso para atención.',
        href: `/tickets/${payload.ticketId}`,
      });
    };
    const onResuelto = (payload: { ticketId?: string; numero?: string }) => {
      if (!payload.ticketId) {
        return;
      }
      mostrar({
        titulo: `${payload.numero ?? 'Ticket'} solucionado`,
        cuerpo: 'Confirma si tu solicitud ya está resuelta.',
        href: `/tickets/${payload.ticketId}`,
      });
    };
    const onCreado = (payload: { id?: string; ticketId?: string; numero?: string; titulo?: string }) => {
      const id = payload.id ?? payload.ticketId;
      if (!id || !esMesa) {
        return;
      }
      if (rutaRef.current.startsWith('/tickets')) {
        return;
      }
      mostrar({
        titulo: `Nuevo ticket ${payload.numero ?? ''}`.trim(),
        cuerpo: payload.titulo ?? 'Caso creado',
        href: `/tickets/${id}`,
      });
    };
    socket.on('ticket:mensaje', onMensaje);
    socket.on('ticket:asignado', onAsignado);
    socket.on('ticket:resuelto', onResuelto);
    socket.on('ticket:creado', onCreado);
    return () => {
      socket.off('ticket:mensaje', onMensaje);
      socket.off('ticket:asignado', onAsignado);
      socket.off('ticket:resuelto', onResuelto);
      socket.off('ticket:creado', onCreado);
      socket.close();
    };
  }, [sesion?.id, esMesa, mostrar]);

  function buscar() {
    const texto = busqueda.trim();
    if (!texto) {
      navigate('/tickets');
      return;
    }
    navigate(`/tickets?q=${encodeURIComponent(texto)}`);
  }

  async function enviarAgente() {
    const texto = textoAgente.trim();
    if (texto.length < 2 || enviandoAgente) {
      return;
    }
    setTextoAgente('');
    setHiloAgente((actual) => [...actual, { id: `u-${Date.now()}`, lado: 'usuario', texto }]);
    setEnviandoAgente(true);
    try {
      const cuerpo = await api<{ respuesta: string }>('/api/agente/web', {
        method: 'POST',
        body: { texto },
      });
      setHiloAgente((actual) => [
        ...actual,
        { id: `a-${Date.now()}`, lado: 'agente', texto: cuerpo.respuesta || 'Sin respuesta del agente.' },
      ]);
    } catch {
      setHiloAgente((actual) => [
        ...actual,
        { id: `e-${Date.now()}`, lado: 'agente', texto: 'No pude responder ahora. Intenta de nuevo en un momento.' },
      ]);
    } finally {
      setEnviandoAgente(false);
    }
  }

  return (
    <Layout className="shell-app" style={{ minHeight: '100vh' }}>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <Sider className="sider-app" breakpoint="lg" collapsedWidth={0} width={248}>
        <div className="sider-cuerpo">
          <MarcaSis lema="Soporte de hardware, redes y apps básicas" />
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[location.pathname]}
            items={menuVisible(sesion?.permisos ?? []).map((item) => ({
              key: item.ruta,
              icon: ICONOS[item.ruta],
              label: item.etiqueta,
            }))}
            onClick={({ key }) => navigate(key)}
          />
          <div className="sider-pie">
            <span className={enVivo ? 'punto punto-ok' : 'punto'} aria-hidden="true" />
            <div>
              <strong>{enVivo ? 'Sistema en vivo' : 'Sin conexión'}</strong>
              <small>{sesion?.sedeNombre ?? 'Sin sede asignada'}</small>
            </div>
          </div>
        </div>
      </Sider>
      <Layout>
        <Header className="cabecera-app">
          <form
            className="cabecera-buscar"
            onSubmit={(evento) => {
              evento.preventDefault();
              buscar();
            }}
          >
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Buscar tickets, actas o conocimiento…"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              aria-label="Buscar"
            />
          </form>
          <div className="cabecera-acciones">
            <div className="en-vivo solo-movil">
              <span className={enVivo ? 'punto punto-ok' : 'punto'} aria-hidden="true" />
              <span>{enVivo ? 'En vivo' : 'Sin conexión'}</span>
            </div>
            <Badge count={0} showZero={false}>
              <Button
                type="text"
                className="cabecera-icono"
                aria-label="Notificaciones"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                onClick={() => navigate('/notificaciones')}
              />
            </Badge>
            <div className="quien-chip">
              <Avatar style={{ background: '#14a3a3' }}>{iniciales}</Avatar>
              <div className="quien">
                <strong>{sesion?.nombre ?? 'Invitado'}</strong>
                <span>
                  {sesion
                    ? `${ETIQUETA_ROL[sesion.rol] ?? sesion.rol} · ${sesion.sedeNombre ?? 'Sin sede'}`
                    : 'Sin sesión · Sin sede'}
                </span>
              </div>
            </div>
            <Button
              type="text"
              onClick={() => {
                void api('/api/auth/logout', { method: 'POST' }).finally(() => navigate('/login'));
              }}
            >
              Salir
            </Button>
          </div>
        </Header>
        <Content id="contenido" className="contenido-app">
          {sesion?.faltaPerfil && (
            <p className="aviso-db">
              Falta tu ubicación habitual.{' '}
              <Button type="link" onClick={() => navigate('/acceso')}>
                Completarla
              </Button>
              . Tus casos ya se pueden ver.
            </p>
          )}
          {sesion && !rutaPermitida(location.pathname, sesion.permisos) ? (
            <p>Esta pantalla no está en tu rol. Tus solicitudes están en Tickets.</p>
          ) : (
            <Outlet context={sesion} />
          )}
        </Content>
      </Layout>

      {sesion && location.pathname !== '/agente' && (
        <>
          {chatAbierto && (
            <aside className="chat-flotante" aria-label="Agente web AI">
              <header>
                <div>
                  <strong>Agente IA · N1</strong>
                  <span>Disponible para todos los roles</span>
                </div>
                <Button
                  type="text"
                  aria-label="Cerrar asistente"
                  icon={<CloseOutlined />}
                  onClick={() => setChatAbierto(false)}
                />
              </header>
              <div className="chat-flotante-cuerpo chat-flotante-hilo">
                {hiloAgente.map((burbuja) => (
                  <div key={burbuja.id} className={`fab-burbuja ${burbuja.lado}`}>
                    {burbuja.texto}
                  </div>
                ))}
              </div>
              <div className="chat-flotante-composer">
                <Input.TextArea
                  rows={2}
                  value={textoAgente}
                  onChange={(evento) => setTextoAgente(evento.target.value)}
                  placeholder="Escribe tu consulta…"
                  onPressEnter={(evento) => {
                    if (!evento.shiftKey) {
                      evento.preventDefault();
                      void enviarAgente();
                    }
                  }}
                />
                <Button type="primary" block loading={enviandoAgente} onClick={() => void enviarAgente()}>
                  Enviar
                </Button>
                {esMesa && (
                  <Button block onClick={() => navigate('/agente')}>
                    Ver supervisión
                  </Button>
                )}
              </div>
            </aside>
          )}
          <button
            type="button"
            className={`fab-agente${chatAbierto ? ' abierto' : ''}`}
            aria-label={chatAbierto ? 'Cerrar asistente' : 'Abrir agente web AI'}
            onClick={() => setChatAbierto((valor) => !valor)}
          >
            {chatAbierto ? <CloseOutlined /> : <RobotOutlined />}
          </button>
        </>
      )}
    </Layout>
  );
}
