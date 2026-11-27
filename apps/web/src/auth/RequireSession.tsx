import { Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ErrorHttp, type Sesion, api } from '../api/http';
import { TiempoRealProvider } from '../api/tiempo-real';
import { PendientePage } from '../pages/PendientePage';

export function RequireSession() {
  const [estado, setEstado] = useState<'carga' | 'ok' | 'no' | 'pendiente' | 'base'>('carga');
  const [sesion, setSesion] = useState<Sesion | null>(null);

  useEffect(() => {
    api<Sesion>('/api/auth/me')
      .then((actual) => {
        setSesion(actual);
        if (!actual.puedeEntrar) {
          setEstado('pendiente');
        } else {
          setEstado('ok');
        }
      })
      .catch((error: unknown) => {
        setEstado(error instanceof ErrorHttp && error.status === 503 ? 'base' : 'no');
      });
  }, []);

  if (estado === 'carga') {
    return <p className="login-panel">Comprobando la sesión…</p>;
  }
  if (estado === 'base') {
    return <p className="login-panel aviso-db">La base de datos no está disponible.</p>;
  }
  if (estado === 'no') {
    return <Navigate to="/login" replace />;
  }
  if (estado === 'pendiente') {
    return <PendientePage />;
  }
  return (
    <TiempoRealProvider>
      <Outlet context={sesion} />
    </TiempoRealProvider>
  );
}
