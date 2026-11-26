import {
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  FileAddOutlined,
  InboxOutlined,
  RobotOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, Layout, Menu } from 'antd';
import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { api, obtenerJson, type Sesion } from '../api/http';
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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <Sider className="sider-app" breakpoint="lg" collapsedWidth={0} width={240}>
        <div className="marca">
          <div className="marca-s" aria-hidden="true">
            S
          </div>
          <div>
            <strong>SIS</strong>
            <small>MESA DE AYUDA TI</small>
          </div>
        </div>
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
      </Sider>
      <Layout>
        <Header className="cabecera-app">
          <div className="en-vivo">
            <span className={enVivo ? 'punto punto-ok' : 'punto'} aria-hidden="true" />
            <span>{enVivo ? 'En vivo' : 'Sin conexión'}</span>
          </div>
          <Badge count={0} showZero>
            <Button
              type="text"
              aria-label="Notificaciones"
              icon={<BellOutlined style={{ fontSize: 18 }} />}
              onClick={() => navigate('/notificaciones')}
            />
          </Badge>
          <Avatar style={{ background: '#14a3a3' }}>{iniciales}</Avatar>
          <div className="quien">
            <strong>{sesion?.nombre ?? 'Invitado'}</strong>
            <span>
              {sesion
                ? `${ETIQUETA_ROL[sesion.rol] ?? sesion.rol} · ${sesion.sedeNombre ?? 'Sin sede'}`
                : 'Sin sesión · Sin sede'}
            </span>
          </div>
          <Button
            type="text"
            onClick={() => {
              void api('/api/auth/logout', { method: 'POST' }).finally(() => navigate('/login'));
            }}
          >
            Salir
          </Button>
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
            <Outlet />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
