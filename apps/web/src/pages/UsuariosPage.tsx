import { useEffect, useState } from 'react';
import { ErrorHttp, api } from '../api/http';

type Usuario = {
  id: string;
  nombre: string;
  rol: string;
  activo: boolean;
  esJefeArea: boolean;
  celular: string | null;
  sede: { nombre: string } | null;
  area: { nombre: string } | null;
};

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [aviso, setAviso] = useState('');

  function cargar() {
    api<Usuario[]>('/api/usuarios')
      .then(setUsuarios)
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se pudieron cargar los usuarios.'));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cambiarRol(id: string, rol: string) {
    await api(`/api/usuarios/${id}`, { method: 'PATCH', body: { rol } });
    cargar();
  }

  return (
    <section>
      <h1>Usuarios, áreas y roles</h1>
      <p>Cada cambio queda en la auditoría del sistema.</p>
      {aviso && <p className="aviso-db">{aviso}</p>}
      <ul>
        {usuarios.map((usuario) => (
          <li key={usuario.id}>
            {usuario.nombre} · {usuario.rol} · {usuario.sede?.nombre ?? 'Sin sede'} · {usuario.area?.nombre ?? 'Sin área'}
            {usuario.celular ? ` · ${usuario.celular}` : ' · sin correo corporativo'}
            <select aria-label={`Rol de ${usuario.nombre}`} value={usuario.rol} onChange={(evento) => cambiarRol(usuario.id, evento.target.value)}>
              <option value="SOLICITANTE">Solicitante</option>
              <option value="TECNICO">Técnico</option>
              <option value="ADMINISTRADOR">Administrador</option>
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}
