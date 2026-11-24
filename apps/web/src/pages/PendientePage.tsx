import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/http';

export function PendientePage() {
  const navigate = useNavigate();

  async function salir() {
    await api('/api/auth/logout', { method: 'POST' });
    navigate('/login');
  }

  return (
    <main className="login-panel">
      <h1>Ingreso pendiente</h1>
      <p>Un administrador debe aprobar tu cuenta de Gmail antes de usar la mesa.</p>
      <Button onClick={salir}>Cerrar sesión</Button>
    </main>
  );
}
