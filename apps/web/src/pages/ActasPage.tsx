import { Button, Form, Input } from 'antd';
import { useEffect, useState } from 'react';
import { ErrorHttp, api } from '../api/http';
import { Link } from 'react-router-dom';

type Acta = {
  id: string;
  numero: string;
  version: number;
  estado: string;
  sellada?: boolean;
  plazoRestanteHoras?: number;
  ticket: { numero: string } | null;
  orden: { numero: string } | null;
};

export function ActasPage() {
  const [actas, setActas] = useState<Acta[]>([]);
  const [aviso, setAviso] = useState('');

  function cargar() {
    api<Acta[]>('/api/actas')
      .then(setActas)
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se cargaron las actas.'));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function generar(valores: {
    ticketId: string;
    diagnostico: string;
    actividades: string;
    estadoFinal: string;
    repuestos?: string;
    observaciones?: string;
  }) {
    try {
      await api('/api/actas', { method: 'POST', body: valores });
      setAviso('Acta generada. Aún no tiene PDF ni firma.');
      cargar();
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se generó el acta.');
    }
  }

  return (
    <section>
      <h1>Actas de cierre</h1>
      <p>La versión firmada por las dos partes tiene PDF, código y hash. Una firma rechazada deja el caso otra vez en sitio.</p>
      {aviso && <p className="aviso-db">{aviso}</p>}
      <ul>
        {actas.map((acta) => (
          <li key={acta.id}>
            <Link to={`/actas/${acta.id}`}>{acta.numero}</Link> v{acta.version} · {acta.estado}
            {acta.estado === 'PENDIENTE_DE_FIRMA' ? ` · quedan ${acta.plazoRestanteHoras} h` : ''}
            {acta.sellada ? ' · PDF sellado' : ''} · {acta.ticket?.numero ?? acta.orden?.numero}
          </li>
        ))}
      </ul>
      <h2>Generar</h2>
      <Form layout="vertical" onFinish={generar}>
        <Form.Item name="ticketId" label="Ticket N2 o N3" rules={[{ required: true, message: 'Pega el identificador del ticket' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="diagnostico" label="Diagnóstico" rules={[{ required: true, min: 4 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="actividades" label="Actividades" rules={[{ required: true, min: 4 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="repuestos" label="Repuestos">
          <Input />
        </Form.Item>
        <Form.Item name="estadoFinal" label="Estado final" rules={[{ required: true, min: 3 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="observaciones" label="Observaciones del solicitante">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          Generar acta
        </Button>
      </Form>
    </section>
  );
}
