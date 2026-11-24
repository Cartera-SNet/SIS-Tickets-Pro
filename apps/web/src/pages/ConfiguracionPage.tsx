import { Button } from 'antd';
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ErrorHttp, type Sesion, api } from '../api/http';

type Fallo = { id: string; nombre: string; reintentos: number; fecha: string };

export function ConfiguracionPage() {
  const sesion = useOutletContext<Sesion | null>();
  const [fallidos, setFallidos] = useState<Fallo[]>([]);
  const [aviso, setAviso] = useState('');
  const puede = sesion?.permisos.includes('configuracion.editar') ?? false;

  useEffect(() => {
    if (!puede) {
      return;
    }
    api<Fallo[]>('/api/cola/fallidos')
      .then(setFallidos)
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'La cola no responde.'));
  }, [puede]);

  async function ensayar() {
    try {
      await api('/api/cola/ensayo', { method: 'POST' });
      setAviso('Se encoló un fallo de prueba. Actualiza para verlo en la lista.');
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo encolar.');
    }
  }

  return (
    <section>
      <h1>Configuración</h1>
      <p>
        <Link to="/configuracion/catalogos">Catálogos y tiempos</Link>
        {' · '}
        <Link to="/configuracion/usuarios">Usuarios y roles</Link>
        {' · '}
        <Link to="/configuracion/matriz">Matriz de avisos</Link>
        {' · '}
        <Link to="/configuracion/agente">Agente IA</Link>
        {' · '}
        <Link to="/configuracion/plantillas">Plantillas de WhatsApp</Link>
      </p>
      {!puede && <p>El resto de parámetros llega en los sprints de administración.</p>}
      {puede && (
        <>
          <h2>Cola de trabajos fallidos</h2>
          <p>WhatsApp, correo, recordatorios y órdenes se reintentan con espera creciente.</p>
          {aviso && <p className="aviso-db">{aviso}</p>}
          <Button onClick={ensayar}>Encolar un fallo de prueba</Button>
          <ul>
            {fallidos.map((fallo) => (
              <li key={fallo.id}>
                {fallo.nombre} · {fallo.reintentos} reintentos
              </li>
            ))}
          </ul>
          {fallidos.length === 0 && !aviso && <p>No hay trabajos fallidos.</p>}
        </>
      )}
    </section>
  );
}
