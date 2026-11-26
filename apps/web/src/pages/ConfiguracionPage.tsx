import { Button } from 'antd';
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ErrorHttp, type Sesion, api } from '../api/http';

type Fallo = { id: string; nombre: string; reintentos: number; fecha: string };

const ENLACES = [
  { to: '/configuracion/catalogos', titulo: 'Catálogos y tiempos', nota: 'Categorías, sedes, tipos de personal y ANS.' },
  { to: '/configuracion/usuarios', titulo: 'Usuarios y roles', nota: 'Vincula Esculapio, correo y WhatsApp.' },
  { to: '/configuracion/matriz', titulo: 'Matriz de avisos', nota: 'Qué evento notifica y por qué canal.' },
  { to: '/configuracion/agente', titulo: 'Agente IA', nota: 'Confianza, intentos guiados y privacidad.' },
  { to: '/configuracion/plantillas', titulo: 'Plantillas de WhatsApp', nota: 'Estado de aprobación en Meta.' },
];

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
      <div className="pagina-cabecera">
        <div>
          <h1>Configuración</h1>
          <p>Administración de catálogos, usuarios, avisos y el agente.</p>
        </div>
      </div>

      <div className="config-rejilla">
        {ENLACES.map((enlace) => (
          <Link key={enlace.to} className="enlace-config" to={enlace.to}>
            <strong>{enlace.titulo}</strong>
            <small>{enlace.nota}</small>
          </Link>
        ))}
      </div>

      {!puede && <p>El resto de parámetros queda para quien tenga permiso de configuración.</p>}
      {puede && (
        <article className="panel-tarjeta">
          <h2>Cola de trabajos fallidos</h2>
          <p>WhatsApp, correo, recordatorios y órdenes se reintentan con espera creciente.</p>
          {aviso && <p className="aviso-db">{aviso}</p>}
          <Button onClick={() => void ensayar()} style={{ marginBottom: 12 }}>
            Encolar un fallo de prueba
          </Button>
          <table className="tabla-sis">
            <thead>
              <tr>
                <th>Trabajo</th>
                <th>Reintentos</th>
              </tr>
            </thead>
            <tbody>
              {fallidos.map((fallo) => (
                <tr key={fallo.id}>
                  <td>{fallo.nombre}</td>
                  <td>{fallo.reintentos}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {fallidos.length === 0 && !aviso && <p>No hay trabajos fallidos.</p>}
        </article>
      )}
    </section>
  );
}
