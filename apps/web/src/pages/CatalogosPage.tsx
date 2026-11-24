import { Button, Form, Input, InputNumber, Select } from 'antd';
import { useEffect, useState } from 'react';
import { ErrorHttp, api } from '../api/http';

type Categoria = { id: string; nombre: string };
type Prioridad = {
  id: string;
  codigo: string;
  nombre: string;
  version: number;
  primeraRespuestaValor: number;
  primeraRespuestaUnidad: string;
  solucionValor: number;
  solucionUnidad: string;
};
type Tipo = { id: string; nombre: string };
type Sede = { id: string; nombre: string };
type Area = { id: string; nombre: string };
type Sync = { creadas: string[]; sinCambios: string[]; conflictos: { nombre: string; codigoLocal: string | null; codigoRemoto: string }[] };

export function CatalogosPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [prioridades, setPrioridades] = useState<Prioridad[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [sync, setSync] = useState<Sync | null>(null);
  const [aviso, setAviso] = useState('');

  function cargar() {
    Promise.all([
      api<Categoria[]>('/api/catalogos/categorias'),
      api<Prioridad[]>('/api/catalogos/prioridades'),
      api<Tipo[]>('/api/catalogos/tipos-personal'),
      api<Sede[]>('/api/catalogos/sedes'),
      api<{ areas: Area[] }>('/api/auth/catalogo'),
    ])
      .then(([cats, pris, listaTipos, listaSedes, catalogo]) => {
        setCategorias(cats);
        setPrioridades(pris);
        setTipos(listaTipos);
        setSedes(listaSedes);
        setAreas(catalogo.areas);
      })
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se cargaron los catálogos.'));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function nuevaCategoria(valores: { nombre: string }) {
    await api('/api/catalogos/categorias', { method: 'POST', body: valores });
    cargar();
  }

  async function guardarAns(id: string, valores: Omit<Prioridad, 'id' | 'codigo' | 'nombre' | 'version'>) {
    await api(`/api/catalogos/prioridades/${id}`, { method: 'PATCH', body: valores });
    cargar();
  }

  async function sincronizar() {
    const resultado = await api<Sync>('/api/catalogos/esculapio/sincronizar', { method: 'POST' });
    setSync(resultado);
    cargar();
  }

  async function alta(valores: { nombre: string; celular: string; sedeId: string; areaId: string; tipoPersonalId: string }) {
    const creado = await api<{ nombre: string }>('/api/usuarios/sin-correo', { method: 'POST', body: valores });
    setAviso(`Quedó registrado ${creado.nombre}. Reportará por WhatsApp cuando el canal esté activo.`);
  }

  return (
    <section>
      <h1>Catálogos</h1>
      {aviso && <p>{aviso}</p>}
      <h2>Categorías</h2>
      <ul>
        {categorias.map((item) => (
          <li key={item.id}>{item.nombre}</li>
        ))}
      </ul>
      <Form layout="inline" onFinish={nuevaCategoria}>
        <Form.Item name="nombre" rules={[{ required: true, message: 'Escribe el nombre' }]}>
          <Input placeholder="Nueva categoría" aria-label="Nueva categoría" />
        </Form.Item>
        <Button htmlType="submit">Agregar</Button>
      </Form>

      <h2>Tiempos de respuesta</h2>
      {prioridades.map((prioridad) => (
        <Form
          key={prioridad.id}
          layout="inline"
          style={{ marginBottom: 12 }}
          initialValues={prioridad}
          onFinish={(valores) => guardarAns(prioridad.id, valores)}
        >
          <strong style={{ marginRight: 8 }}>
            {prioridad.nombre} v{prioridad.version}
          </strong>
          <Form.Item name="primeraRespuestaValor">
            <InputNumber min={1} aria-label={`Primera respuesta ${prioridad.nombre}`} />
          </Form.Item>
          <Form.Item name="primeraRespuestaUnidad">
            <Select
              style={{ width: 140 }}
              options={['MINUTOS', 'HORAS', 'DIAS_HABILES'].map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Form.Item name="solucionValor">
            <InputNumber min={1} aria-label={`Solución ${prioridad.nombre}`} />
          </Form.Item>
          <Form.Item name="solucionUnidad">
            <Select
              style={{ width: 140 }}
              options={['MINUTOS', 'HORAS', 'DIAS_HABILES'].map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Button htmlType="submit">Guardar versión</Button>
        </Form>
      ))}

      <h2>Sedes desde Esculapio</h2>
      <p>Hoy es una simulación. Las APIs de PostgreSQL de Esculapio todavía no existen.</p>
      <Button onClick={sincronizar}>Sincronizar sedes de ejemplo</Button>
      {sync && (
        <p>
          Creadas: {sync.creadas.join(', ') || 'ninguna'}. Conflictos:{' '}
          {sync.conflictos.map((item) => `${item.nombre} (${item.codigoRemoto} vs ${item.codigoLocal})`).join(', ') || 'ninguno'}.
        </p>
      )}

      <h2>Colaborador sin correo</h2>
      <Form layout="vertical" onFinish={alta} style={{ maxWidth: 420 }}>
        <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Escribe el nombre' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="celular" label="Celular" rules={[{ required: true, message: 'Escribe el celular' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="sedeId" label="Sede" rules={[{ required: true, message: 'Elige la sede' }]}>
          <Select options={sedes.map((item) => ({ value: item.id, label: item.nombre }))} />
        </Form.Item>
        <Form.Item name="areaId" label="Área" rules={[{ required: true, message: 'Elige el área' }]}>
          <Select options={areas.map((item) => ({ value: item.id, label: item.nombre }))} />
        </Form.Item>
        <Form.Item name="tipoPersonalId" label="Tipo de personal" rules={[{ required: true, message: 'Elige el tipo' }]}>
          <Select options={tipos.map((item) => ({ value: item.id, label: item.nombre }))} />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          Registrar
        </Button>
      </Form>
    </section>
  );
}
