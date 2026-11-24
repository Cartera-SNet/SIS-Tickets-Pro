import { Button, Checkbox, Form, Input, Select } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorHttp, type Sesion, api, prepararCsrf } from '../api/http';

type Catalogo = {
  sedes: { id: string; nombre: string }[];
  areas: { id: string; nombre: string; sedeId: string | null }[];
  ubicaciones: { id: string; nombre: string; sedeId: string; piso: string | null }[];
};

export function AccesoPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [aviso, setAviso] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoPrueba, setCodigoPrueba] = useState('');

  useEffect(() => {
    prepararCsrf().catch(() => undefined);
    api<Catalogo>('/api/auth/catalogo')
      .then(setCatalogo)
      .catch((error: unknown) => setAviso(mensaje(error)));
    if (!token) {
      api<Sesion>('/api/auth/me')
        .then((actual) => {
          setSesion(actual);
          if (actual.puedeEntrar && !actual.faltaPerfil) {
            navigate('/');
          }
        })
        .catch(() => navigate('/login'));
    }
  }, [navigate, token]);

  async function completarGmail(valores: { sedeId: string; areaId: string; correoNotificaciones: string }) {
    try {
      await api('/api/auth/google/completar', { method: 'POST', body: { token, ...valores } });
      navigate('/acceso');
    } catch (error) {
      setAviso(mensaje(error));
    }
  }

  async function guardarPerfil(valores: {
    correoNotificaciones: string;
    ubicacionHabitualId: string;
    celular?: string;
    autorizaDatos?: boolean;
  }) {
    try {
      const cuerpo = await api<{ requiereCodigo: boolean; codigoPrueba?: string }>('/api/auth/perfil', {
        method: 'POST',
        body: valores,
      });
      if (cuerpo.requiereCodigo) {
        setCodigoPrueba(cuerpo.codigoPrueba ?? '');
        setAviso('Te enviamos un código. Si WhatsApp está simulado, úsalo aquí.');
        return;
      }
      navigate('/');
    } catch (error) {
      setAviso(mensaje(error));
    }
  }

  async function confirmar() {
    try {
      await api('/api/auth/celular/confirmar', { method: 'POST', body: { codigo } });
      navigate('/');
    } catch (error) {
      setAviso(mensaje(error));
    }
  }

  return (
    <main className="login-panel">
      <h1>Empresa, sede y contacto</h1>
      {aviso && <p className="aviso-db">{aviso}</p>}
      {token && (
        <Form layout="vertical" onFinish={completarGmail}>
          <Form.Item name="sedeId" label="Sede" rules={[{ required: true, message: 'Elige la sede' }]}>
            <Select options={(catalogo?.sedes ?? []).map((sede) => ({ value: sede.id, label: sede.nombre }))} />
          </Form.Item>
          <Form.Item name="areaId" label="Área" rules={[{ required: true, message: 'Elige el área' }]}>
            <Select options={(catalogo?.areas ?? []).map((area) => ({ value: area.id, label: area.nombre }))} />
          </Form.Item>
          <Form.Item
            name="correoNotificaciones"
            label="Correo de notificaciones"
            rules={[{ required: true, type: 'email', message: 'Escribe un correo válido' }]}
          >
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            Continuar
          </Button>
        </Form>
      )}
      {sesion && (
        <Form layout="vertical" onFinish={guardarPerfil} initialValues={{ correoNotificaciones: sesion.correoNotificaciones ?? '' }}>
          <Form.Item
            name="ubicacionHabitualId"
            label="Ubicación habitual"
            rules={[{ required: true, message: 'Confirma dónde trabajas' }]}
          >
            <Select
              options={(catalogo?.ubicaciones ?? []).map((ubicacion) => ({
                value: ubicacion.id,
                label: ubicacion.piso ? `${ubicacion.nombre} · piso ${ubicacion.piso}` : ubicacion.nombre,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="correoNotificaciones"
            label="Correo de notificaciones"
            rules={[{ required: true, type: 'email', message: 'Escribe un correo válido' }]}
          >
            <Input />
          </Form.Item>
          {sesion.celularPermitido && !sesion.celularVerificado && (
            <>
              <Form.Item name="celular" label="Celular">
                <Input />
              </Form.Item>
              <Form.Item name="autorizaDatos" valuePropName="checked">
                <Checkbox>Autorizo el tratamiento de mis datos (Ley 1581 de 2012) para recibir el código por WhatsApp.</Checkbox>
              </Form.Item>
            </>
          )}
          <Button type="primary" htmlType="submit">
            Guardar
          </Button>
        </Form>
      )}
      {codigoPrueba && <p>Código de prueba: {codigoPrueba}</p>}
      {codigoPrueba && (
        <Form layout="inline" onFinish={confirmar}>
          <Input value={codigo} onChange={(evento) => setCodigo(evento.target.value)} maxLength={6} aria-label="Código" />
          <Button htmlType="submit">Verificar celular</Button>
        </Form>
      )}
    </main>
  );
}

function mensaje(error: unknown): string {
  return error instanceof ErrorHttp || error instanceof Error ? error.message : 'No se pudo guardar.';
}
