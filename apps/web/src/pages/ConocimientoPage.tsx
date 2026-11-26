import { Button, Form, Input, Select } from 'antd';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ErrorHttp, type Sesion, api } from '../api/http';

type Articulo = {
  id: string;
  codigo: string;
  titulo: string;
  pasos: string;
  estado: string;
  usos?: number;
  casosResueltos?: number;
  reclasificaciones?: number;
  categoria: { nombre: string } | null;
};
type Categoria = { id: string; nombre: string };

export function ConocimientoPage() {
  const sesion = useOutletContext<Sesion | null>();
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [aviso, setAviso] = useState('');
  const puedePublicar = sesion?.permisos.includes('kb.aprobar') ?? false;

  function cargar() {
    Promise.all([api<Articulo[]>('/api/conocimiento'), api<Categoria[]>('/api/catalogos/categorias')])
      .then(([lista, cats]) => {
        setArticulos(lista);
        setCategorias(cats);
      })
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se cargaron los artículos.'));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(valores: { titulo: string; categoriaId: string; pasos: string }) {
    await api('/api/conocimiento', { method: 'POST', body: valores });
    cargar();
  }

  async function publicar(id: string) {
    await api(`/api/conocimiento/${id}`, { method: 'PATCH', body: { estado: 'PUBLICADO' } });
    cargar();
  }

  return (
    <section>
      <div className="pagina-cabecera">
        <div>
          <h1>Base de conocimiento</h1>
          <p>Solo los publicados los usa el agente N1. Un administrador aprueba el borrador.</p>
        </div>
      </div>
      {aviso && <p className="aviso-db">{aviso}</p>}

      <article className="tabla-caja" style={{ marginBottom: 16 }}>
        <table className="tabla-sis">
          <thead>
            <tr>
              <th>Código</th>
              <th>Título</th>
              <th>Categoría</th>
              <th>Estado</th>
              <th>Usos</th>
              <th>Resueltos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {articulos.map((articulo) => (
              <tr key={articulo.id}>
                <td>{articulo.codigo}</td>
                <td>{articulo.titulo}</td>
                <td>{articulo.categoria?.nombre ?? '—'}</td>
                <td>
                  <span className={articulo.estado === 'PUBLICADO' ? 'chip chip-ok' : 'chip chip-aviso'}>
                    {articulo.estado === 'PUBLICADO' ? 'Publicado' : 'Borrador'}
                  </span>
                </td>
                <td>{articulo.usos ?? 0}</td>
                <td>{articulo.casosResueltos ?? 0}</td>
                <td>
                  {puedePublicar && articulo.estado === 'BORRADOR' && (
                    <Button size="small" type="primary" onClick={() => void publicar(articulo.id)}>
                      Publicar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {articulos.length === 0 && <p>No hay artículos todavía.</p>}
      </article>

      <Form className="panel-tarjeta" layout="vertical" onFinish={crear} style={{ maxWidth: 560 }}>
        <h2>Nuevo artículo</h2>
        <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Escribe el título' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="categoriaId" label="Categoría" rules={[{ required: true, message: 'Elige la categoría' }]}>
          <Select options={categorias.map((item) => ({ value: item.id, label: item.nombre }))} />
        </Form.Item>
        <Form.Item name="pasos" label="Pasos" rules={[{ required: true, message: 'Escribe los pasos' }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          Guardar borrador
        </Button>
      </Form>
    </section>
  );
}
