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
      <h1>Base de conocimiento</h1>
      <p>Un artículo solo se sugiere al usuario cuando un administrador lo publica.</p>
      {aviso && <p className="aviso-db">{aviso}</p>}
      <ul>
        {articulos.map((articulo) => (
          <li key={articulo.id}>
            {articulo.codigo} · {articulo.titulo} · {articulo.estado} · usos {articulo.usos ?? 0} · resueltos{' '}
            {articulo.casosResueltos ?? 0} · reclasificaciones {articulo.reclasificaciones ?? 0}
            {puedePublicar && articulo.estado === 'BORRADOR' && (
              <Button onClick={() => publicar(articulo.id)}>Publicar</Button>
            )}
          </li>
        ))}
      </ul>
      <Form layout="vertical" onFinish={crear} style={{ maxWidth: 520 }}>
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
