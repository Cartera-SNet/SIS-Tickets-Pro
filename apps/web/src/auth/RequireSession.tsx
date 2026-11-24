import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ErrorHttp, type Sesion, api } from '../api/http';
import { PendientePage } from '../pages/PendientePage';

export function RequireSession() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<'carga' | 'ok' | 'no' | 'pendiente' | 'base'>('carga');
  const [sesion, setSesion] = useState<Sesion | null>(null);

  useEffect(() => {
    api<Sesion>('/api/auth/me')
      .then((actual) => {
        setSesion(actual);
        if (!actual.puedeEntrar) {
          setEstado('pendiente');
        } else if (actual.faltaPerfil) {
          navigate('/acceso');
        } else {
          setEstado('ok');
        }
      })
      .catch((error: unknown) => {
        setEstado(error instanceof ErrorHttp && error.status === 503 ? 'base' : 'no');
      });
  }, [navigate]);

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
  return <Outlet context={sesion} />;
}
