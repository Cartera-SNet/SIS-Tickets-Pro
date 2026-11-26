import { Button, Form, Input, InputNumber, Select, Switch } from 'antd';
import { useEffect, useState } from 'react';
import { ErrorHttp, api } from '../api/http';
import { useNavigate } from 'react-router-dom';

type Categoria = { id: string; nombre: string; subcategorias: { id: string; nombre: string }[] };
type Sede = { id: string; nombre: string; ubicaciones: { id: string; nombre: string; piso: string | null }[] };
type Equipo = { id: string; placa: string | null; tipo: string };

export function NuevoTicketPage() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [categoriaId, setCategoriaId] = useState<string>();
  const [aviso, setAviso] = useState('');
  const [sugerencias, setSugerencias] = useState<{ id: string; codigo: string; titulo: string; pasos: string }[]>([]);

  useEffect(() => {
    Promise.all([
      api<Categoria[]>('/api/catalogos/categorias'),
      api<Sede[]>('/api/catalogos/sedes'),
      api<Equipo[]>('/api/catalogos/equipos'),
    ])
      .then(([cats, listaSedes, listaEquipos]) => {
        setCategorias(cats);
        setSedes(listaSedes);
        setEquipos(listaEquipos);
      })
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se cargaron los catálogos.'));
  }, []);

  useEffect(() => {
    if (!categoriaId) {
      setSugerencias([]);
      return;
    }
    api<{ id: string; codigo: string; titulo: string; pasos: string }[]>(
      `/api/conocimiento/sugerencias?categoriaId=${categoriaId}`,
    )
      .then(setSugerencias)
      .catch(() => setSugerencias([]));
  }, [categoriaId]);
  const subcategorias = categorias.find((item) => item.id === categoriaId)?.subcategorias ?? [];
  const ubicaciones = sedes.flatMap((sede) =>
    sede.ubicaciones.map((ubicacion) => ({
      id: ubicacion.id,
      etiqueta: ubicacion.piso ? `${sede.nombre} · ${ubicacion.nombre} · piso ${ubicacion.piso}` : `${sede.nombre} · ${ubicacion.nombre}`,
    })),
  );

  async function enviar(valores: {
    categoriaId: string;
    subcategoriaId?: string;
    titulo: string;
    descripcion: string;
    ubicacionId: string;
    equipoId?: string;
    puedeTrabajar: boolean;
    personas: number;
    areaCompleta: boolean;
  }) {
    try {
      const creado = await api<{ id: string; numero: string; prioridad: string }>('/api/tickets', {
        method: 'POST',
        body: {
          ...valores,
          subcategoriaId: valores.subcategoriaId || undefined,
          equipoId: valores.equipoId || undefined,
          puedeTrabajar: valores.puedeTrabajar ?? true,
          areaCompleta: valores.areaCompleta ?? false,
        },
      });
      navigate(`/tickets/${creado.id}`);
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo crear el caso.');
    }
  }

  return (
    <section>
      <div className="pagina-cabecera">
        <div>
          <h1>Nuevo ticket</h1>
          <p>Cuéntanos qué pasa con el equipo, la red o un programa. Mira las sugerencias antes de enviar.</p>
        </div>
      </div>
      {aviso && <p className="aviso-db">{aviso}</p>}
      {sugerencias.length > 0 && (
        <aside className="panel-tarjeta" style={{ marginBottom: 14 }}>
          <h2>Antes de enviar, mira esto</h2>
          <ul>
            {sugerencias.map((articulo) => (
              <li key={articulo.id}>
                <strong>
                  {articulo.codigo} · {articulo.titulo}
                </strong>
                <p>{articulo.pasos}</p>
              </li>
            ))}
          </ul>
          <p>Puedes enviar el caso aunque no te haya servido. Las solicitudes de desarrollo de software se descartan y se redirigen.</p>
        </aside>
      )}
      <Form
        className="panel-tarjeta"
        layout="vertical"
        onFinish={enviar}
        initialValues={{ puedeTrabajar: true, personas: 1, areaCompleta: false }}
      >
        <Form.Item name="titulo" label="Qué necesitas" rules={[{ required: true, min: 4, message: 'Describe el caso en una frase' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="descripcion" label="Qué está pasando" rules={[{ required: true, min: 8, message: 'Cuéntanos un poco más' }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item name="categoriaId" label="Categoría" rules={[{ required: true, message: 'Elige una categoría' }]}>
          <Select onChange={setCategoriaId}>
            {categorias.map((item) => (
              <Select.Option key={item.id} value={item.id}>
                {item.nombre}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="subcategoriaId" label="Detalle">
          <Select allowClear>
            {subcategorias.map((item) => (
              <Select.Option key={item.id} value={item.id}>
                {item.nombre}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="ubicacionId" label="Dónde está" rules={[{ required: true, message: 'Elige la ubicación' }]}>
          <Select>
            {ubicaciones.map((item) => (
              <Select.Option key={item.id} value={item.id}>
                {item.etiqueta}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="equipoId" label="Equipo, si aplica">
          <Select allowClear>
            {equipos.map((item) => (
              <Select.Option key={item.id} value={item.id}>
                {item.placa ?? item.tipo}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="puedeTrabajar" label="¿Puedes seguir trabajando?" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="personas" label="¿A cuántas personas afecta?">
          <InputNumber min={1} />
        </Form.Item>
        <Form.Item name="areaCompleta" label="¿Se detuvo el área completa?" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          Enviar caso
        </Button>
      </Form>
    </section>
  );
}
