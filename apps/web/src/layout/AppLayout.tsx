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
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, Input, Layout, Menu } from 'antd';
import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { api, obtenerJson, type Sesion } from '../api/http';
import { MarcaSis } from '../components/MarcaSis';
import { menuVisible, rutaPermitida } from '../navigation';

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
};

const ETIQUETA_ROL: Record<string, string> = {
  SOLICITANTE: 'Solicitante',
  TECNICO: 'Técnico',
  ADMINISTRADOR: 'Administrador',
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const sesion = useOutletContext<Sesion | null>();
  const [enVivo, setEnVivo] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [chatAbierto, setChatAbierto] = useState(false);
  const puedeAgente = rutaPermitida('/agente', sesion?.permisos ?? []);
  const iniciales = (sesion?.nombre ?? 'IN')
    .split(' ')
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();

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

  function buscar() {
    const texto = busqueda.trim();
    if (!texto) {
      navigate('/tickets');
      return;
    }
    navigate(`/tickets?q=${encodeURIComponent(texto)}`);
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

      {puedeAgente && location.pathname !== '/agente' && (
        <>
          {chatAbierto && (
            <aside className="chat-flotante" aria-label="Asistente de la mesa">
              <header>
                <div>
                  <strong>Agente IA · N1</strong>
                  <span>WhatsApp y mesa de ayuda</span>
                </div>
                <Button
                  type="text"
                  aria-label="Cerrar asistente"
                  icon={<CloseOutlined />}
                  onClick={() => setChatAbierto(false)}
                />
              </header>
              <div className="chat-flotante-cuerpo">
                <p>Revisa conversaciones en curso o interviene cuando el usuario lo pida.</p>
                <Button type="primary" block onClick={() => navigate('/agente')}>
                  Abrir conversaciones
                </Button>
              </div>
            </aside>
          )}
          <button
            type="button"
            className={`fab-agente${chatAbierto ? ' abierto' : ''}`}
            aria-label={chatAbierto ? 'Cerrar asistente' : 'Abrir asistente IA'}
            onClick={() => setChatAbierto((valor) => !valor)}
          >
            {chatAbierto ? <CloseOutlined /> : <RobotOutlined />}
          </button>
        </>
      )}
    </Layout>
  );
}
