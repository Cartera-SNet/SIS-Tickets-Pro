import { ConfigProvider, theme } from 'antd';
import esES from 'antd/locale/es_ES';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireSession } from './auth/RequireSession';
import { AppLayout } from './layout/AppLayout';
import { ToastProvider } from './ui/Toasts';
import { AccesoPage } from './pages/AccesoPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';
import { InicioPage } from './pages/InicioPage';
import { LoginPage } from './pages/LoginPage';
import { ManualPage } from './pages/ManualPage';
import { NuevoTicketPage } from './pages/NuevoTicketPage';
import { CatalogosPage } from './pages/CatalogosPage';
import { AsignacionPage } from './pages/AsignacionPage';
import { AgentePage } from './pages/AgentePage';
import { ActasPage } from './pages/ActasPage';
import { ActaDetallePage } from './pages/ActaDetallePage';
import { FirmarPage } from './pages/FirmarPage';
import { VerificarPage } from './pages/VerificarPage';
import { AgenteConfigPage } from './pages/AgenteConfigPage';
import { MatrizPage } from './pages/MatrizPage';
import { NotificacionesPage } from './pages/NotificacionesPage';
import { ReportesPage } from './pages/ReportesPage';
import { ConocimientoPage } from './pages/ConocimientoPage';
import { DescartesPage } from './pages/DescartesPage';
import { EquipoHistorialPage } from './pages/EquipoHistorialPage';
import { OrdenPreventivaPage } from './pages/OrdenPreventivaPage';
import { PlantillasPage } from './pages/PlantillasPage';
import { PreventivoPage } from './pages/PreventivoPage';
import { TicketDetallePage } from './pages/TicketDetallePage';
import { TicketsPage } from './pages/TicketsPage';
import { UsuariosPage } from './pages/UsuariosPage';

export function App() {
  return (
    <ConfigProvider
      locale={esES}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#14a3a3',
          colorInfo: '#7fb2ff',
          colorSuccess: '#3ccf8e',
          colorWarning: '#e0a100',
          colorError: '#e0413c',
          colorBgBase: '#0b141c',
          colorTextBase: '#e6eef5',
          colorBorder: '#1e3040',
          fontFamily: 'Inter, sans-serif',
          borderRadius: 8,
        },
      }}
    >
      <BrowserRouter>
        <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/acceso" element={<AccesoPage />} />
          <Route path="/firmar/:token" element={<FirmarPage />} />
          <Route path="/verificar" element={<VerificarPage />} />
          <Route element={<RequireSession />}>
            <Route element={<AppLayout />}>
              <Route index element={<InicioPage />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="tickets/nuevo" element={<NuevoTicketPage />} />
              <Route path="tickets/asignacion" element={<AsignacionPage />} />
              <Route path="tickets/descartes" element={<DescartesPage />} />
              <Route path="tickets/:id" element={<TicketDetallePage />} />
              <Route path="configuracion/catalogos" element={<CatalogosPage />} />
              <Route path="configuracion/usuarios" element={<UsuariosPage />} />
              <Route path="agente" element={<AgentePage />} />
              <Route path="preventivo" element={<PreventivoPage />} />
              <Route path="preventivo/ordenes/:id" element={<OrdenPreventivaPage />} />
              <Route path="preventivo/equipos/:id" element={<EquipoHistorialPage />} />
              <Route path="actas" element={<ActasPage />} />
              <Route path="actas/:id" element={<ActaDetallePage />} />
              <Route path="notificaciones" element={<NotificacionesPage />} />
              <Route path="conocimiento" element={<ConocimientoPage />} />
              <Route path="reportes" element={<ReportesPage />} />
              <Route path="configuracion/matriz" element={<MatrizPage />} />
              <Route path="configuracion/agente" element={<AgenteConfigPage />} />
              <Route path="configuracion/plantillas" element={<PlantillasPage />} />
              <Route path="configuracion" element={<ConfiguracionPage />} />
              <Route path="manual" element={<ManualPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
        </ToastProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}
