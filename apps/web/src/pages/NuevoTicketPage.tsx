import { Button, Checkbox, Form, Input, Modal, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorHttp, api } from '../api/http';

type Subcategoria = { id: string; nombre: string };
type Categoria = { id: string; nombre: string; subcategorias: Subcategoria[] };
type Sede = { id: string; nombre: string; ubicaciones: { id: string; nombre: string; piso: string | null }[] };
type Equipo = { id: string; placa: string | null; tipo: string };

export function NuevoTicketPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [categoriaId, setCategoriaId] = useState<string>();
  const [tiposElegidos, setTiposElegidos] = useState<string[]>([]);
  const [observacionOtros, setObservacionOtros] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
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

  const categoriaActiva = useMemo(
    () => categorias.find((item) => item.id === categoriaId) ?? null,
    [categorias, categoriaId],
  );

  const tiposDisponibles = useMemo(() => {
    const lista = [...(categoriaActiva?.subcategorias ?? [])];
    if (!lista.some((item) => item.nombre.toLowerCase() === 'otros')) {
      lista.push({ id: '__otros__', nombre: 'Otros' });
    }
    return lista;
  }, [categoriaActiva]);

  const eligioOtros = tiposElegidos.some((id) => {
    const item = tiposDisponibles.find((tipo) => tipo.id === id);
    return item?.nombre.toLowerCase() === 'otros' || id === '__otros__';
  });

  const resumenTipos = useMemo(() => {
    const nombres = tiposDisponibles
      .filter((tipo) => tiposElegidos.includes(tipo.id))
      .map((tipo) => (tipo.nombre.toLowerCase() === 'otros' && observacionOtros.trim() ? `Otros: ${observacionOtros.trim()}` : tipo.nombre));
    return nombres.join(' · ');
  }, [tiposDisponibles, tiposElegidos, observacionOtros]);

  const ubicaciones = sedes.flatMap((sede) =>
    sede.ubicaciones.map((ubicacion) => ({
      id: ubicacion.id,
      etiqueta: ubicacion.piso
        ? `${sede.nombre} · ${ubicacion.nombre} · piso ${ubicacion.piso}`
        : `${sede.nombre} · ${ubicacion.nombre}`,
    })),
  );

  function abrirCategoria(id: string) {
    setCategoriaId(id);
    form.setFieldValue('categoriaId', id);
    setTiposElegidos([]);
    setObservacionOtros('');
    setModalAbierto(true);
  }

  function confirmarTipos() {
    if (tiposElegidos.length === 0) {
      setAviso('Elige al menos un tipo de incidencia o solicitud.');
      return;
    }
    if (eligioOtros && observacionOtros.trim().length < 4) {
      setAviso('Si eliges Otros, escribe una observación de al menos 4 caracteres.');
      return;
    }
    setAviso('');
    setModalAbierto(false);
  }

  async function enviar(valores: {
    categoriaId: string;
    descripcion: string;
    ubicacionId: string;
    equipoId?: string;
  }) {
    if (!tiposElegidos.length) {
      setAviso('Elige una categoría y al menos un tipo de incidencia.');
      setModalAbierto(true);
      return;
    }
    if (eligioOtros && observacionOtros.trim().length < 4) {
      setAviso('Completa la observación de Otros.');
      setModalAbierto(true);
      return;
    }
    try {
      const idsReales = tiposElegidos.filter((id) => id !== '__otros__');
      const creado = await api<{ id: string; numero: string; prioridad: string }>('/api/tickets', {
        method: 'POST',
        body: {
          categoriaId: valores.categoriaId,
          subcategoriaIds: idsReales,
          observacionCategoria: eligioOtros ? observacionOtros.trim() : undefined,
          descripcion: valores.descripcion,
          ubicacionId: valores.ubicacionId,
          equipoId: valores.equipoId || undefined,
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
          <p>Puedes enviar el caso aunque no te haya servido.</p>
        </aside>
      )}

      <Form className="panel-tarjeta" layout="vertical" form={form} onFinish={(valores) => void enviar(valores)}>
        <Form.Item
          name="descripcion"
          label="Qué está pasando"
          rules={[{ required: true, min: 8, message: 'Cuéntanos un poco más' }]}
        >
          <Input.TextArea rows={4} placeholder="Describe el problema o la solicitud…" />
        </Form.Item>

        <Form.Item
          name="categoriaId"
          label="Categoría"
          rules={[{ required: true, message: 'Elige una categoría' }]}
        >
          <Select
            placeholder="Elige una categoría"
            value={categoriaId}
            onChange={abrirCategoria}
            options={categorias.map((item) => ({ value: item.id, label: item.nombre }))}
          />
        </Form.Item>

        {categoriaActiva && (
          <div className="categoria-resumen">
            <div>
              <strong>{categoriaActiva.nombre}</strong>
              <p>{resumenTipos || 'Sin tipos seleccionados todavía.'}</p>
            </div>
            <Button onClick={() => setModalAbierto(true)}>Elegir tipos</Button>
          </div>
        )}

        <Form.Item name="ubicacionId" label="Dónde está" rules={[{ required: true, message: 'Elige la ubicación' }]}>
          <Select
            options={ubicaciones.map((item) => ({ value: item.id, label: item.etiqueta }))}
            placeholder="Sede · ubicación"
          />
        </Form.Item>

        <Form.Item name="equipoId" label="Equipo, si aplica">
          <Select
            allowClear
            options={equipos.map((item) => ({ value: item.id, label: item.placa ?? item.tipo }))}
            placeholder="Opcional"
          />
        </Form.Item>

        <Button type="primary" htmlType="submit">
          Enviar caso
        </Button>
      </Form>

      <Modal
        title={categoriaActiva ? `Tipos · ${categoriaActiva.nombre}` : 'Tipos de incidencia'}
        open={modalAbierto}
        onCancel={() => setModalAbierto(false)}
        onOk={confirmarTipos}
        okText="Usar estos tipos"
        cancelText="Cancelar"
        destroyOnClose={false}
      >
        <p className="modal-ayuda">Marca una o varias opciones. Si eliges Otros, escribe la observación.</p>
        <Checkbox.Group
          className="tipos-checkboxes"
          value={tiposElegidos}
          onChange={(valores) => setTiposElegidos(valores as string[])}
          options={tiposDisponibles.map((tipo) => ({ value: tipo.id, label: tipo.nombre }))}
        />
        {eligioOtros && (
          <Input.TextArea
            style={{ marginTop: 14 }}
            rows={3}
            value={observacionOtros}
            onChange={(evento) => setObservacionOtros(evento.target.value)}
            placeholder="Observación para Otros…"
            maxLength={500}
          />
        )}
      </Modal>
    </section>
  );
}
