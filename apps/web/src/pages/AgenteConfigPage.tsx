import { Button, Form, Input, InputNumber } from 'antd';
import { useEffect, useState } from 'react';
import { ErrorHttp, api } from '../api/http';

type Agente = {
  umbral: number;
  intentosGuiados: number;
  reglasPrivacidad: string;
  topeDiario: number;
  topeMensual: number;
};

type Integracion = {
  whatsappModo: string;
  secretoConfigurado: boolean;
  tokenVerificacionConfigurado: boolean;
  origen: string;
};

export function AgenteConfigPage() {
  const [aviso, setAviso] = useState('');
  const [inicial, setInicial] = useState<Agente | null>(null);
  const [integracion, setIntegracion] = useState<Integracion | null>(null);

  useEffect(() => {
    api<Agente>('/api/configuracion/agente')
      .then(setInicial)
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se cargó el agente.'));
    api<Integracion>('/api/configuracion/integraciones')
      .then(setIntegracion)
      .catch(() => setIntegracion(null));
  }, []);

  async function guardar(valores: Agente) {
    try {
      await api('/api/configuracion/agente', { method: 'PATCH', body: valores });
      setAviso('Parámetros guardados. El cambio quedó en la auditoría.');
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se guardó.');
    }
  }

  return (
    <section>
      <h1>Agente IA y WhatsApp</h1>
      <p>Los tokens de Meta no se guardan aquí. Viven en variables de entorno.</p>
      {integracion && (
        <p>
          WhatsApp {integracion.whatsappModo}. Secreto {integracion.secretoConfigurado ? 'presente' : 'ausente'}. Token de
          verificación {integracion.tokenVerificacionConfigurado ? 'presente' : 'ausente'}. Origen: {integracion.origen}.
        </p>
      )}
      {aviso && <p className="aviso-db">{aviso}</p>}
      {inicial && (
        <Form layout="vertical" initialValues={inicial} onFinish={guardar}>
          <Form.Item name="umbral" label="Umbral de confianza" rules={[{ required: true }]}>
            <InputNumber min={0.1} max={0.99} step={0.05} />
          </Form.Item>
          <Form.Item name="intentosGuiados" label="Intentos guiados" rules={[{ required: true }]}>
            <InputNumber min={1} max={5} />
          </Form.Item>
          <Form.Item name="reglasPrivacidad" label="Reglas de privacidad" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="topeDiario" label="Tope diario">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="topeMensual" label="Tope mensual">
            <InputNumber min={0} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            Guardar
          </Button>
        </Form>
      )}
    </section>
  );
}
