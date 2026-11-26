import { Button, Form, Input, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { ErrorHttp, api } from '../api/http';
import { Link } from 'react-router-dom';

type Acta = {
  id: string;
  numero: string;
  version: number;
  estado: string;
  sellada?: boolean;
  plazoRestanteHoras?: number | null;
  ticket: { numero: string } | null;
  orden: { numero: string } | null;
};

const ETIQUETA: Record<string, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_DE_FIRMA: 'Pendiente de firma',
  FIRMADA: 'Firmada',
  CERRADA_SIN_FIRMA: 'Cerrada sin firma',
  RECHAZADA: 'Rechazada · reabierto',
};

function claseActa(estado: string): string {
  if (estado === 'FIRMADA') return 'chip chip-ok';
  if (estado === 'PENDIENTE_DE_FIRMA' || estado === 'BORRADOR') return 'chip chip-aviso';
  if (estado === 'RECHAZADA') return 'chip chip-peligro';
  return 'chip';
}

export function ActasPage() {
  const [actas, setActas] = useState<Acta[]>([]);
  const [aviso, setAviso] = useState('');
  const [filtro, setFiltro] = useState<string>();

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

  const visibles = useMemo(
    () => (filtro ? actas.filter((acta) => acta.estado === filtro) : actas),
    [actas, filtro],
  );

  const firmadas = actas.filter((a) => a.estado === 'FIRMADA').length;
  const pendientes = actas.filter((a) => a.estado === 'PENDIENTE_DE_FIRMA').length;
  const sinFirma = actas.filter((a) => a.estado === 'CERRADA_SIN_FIRMA').length;
  const rechazadas = actas.filter((a) => a.estado === 'RECHAZADA').length;

  return (
    <section>
      <div className="pagina-cabecera">
        <div>
          <h1>Actas de cierre</h1>
          <p>Correctivos N2/N3 en sitio y mantenimientos preventivos.</p>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <article className="kpi verde">
          <span>Firmadas</span>
          <strong>{firmadas}</strong>
        </article>
        <article className="kpi ambar">
          <span>Pendientes de firma</span>
          <strong>{pendientes}</strong>
        </article>
        <article className="kpi">
          <span>Cerradas sin firma</span>
          <strong>{sinFirma}</strong>
        </article>
        <article className="kpi" style={{ borderLeftColor: 'var(--danger)' }}>
          <span>Rechazadas</span>
          <strong>{rechazadas}</strong>
        </article>
      </div>

      {aviso && <p className="aviso-db">{aviso}</p>}

      <div className="filtros-fila">
        <Select
          allowClear
          placeholder="Estado"
          style={{ width: 220 }}
          value={filtro}
          onChange={setFiltro}
          options={Object.entries(ETIQUETA).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <article className="tabla-caja" style={{ marginBottom: 16 }}>
        <table className="tabla-sis">
          <thead>
            <tr>
              <th>Acta</th>
              <th>Origen</th>
              <th>Estado</th>
              <th>Plazo</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((acta) => (
              <tr key={acta.id}>
                <td>
                  <Link to={`/actas/${acta.id}`}>{acta.numero}</Link>
                  <span style={{ color: 'var(--text-muted)' }}> · v{acta.version}</span>
                </td>
                <td>{acta.ticket?.numero ?? acta.orden?.numero ?? '—'}</td>
                <td>
                  <span className={claseActa(acta.estado)}>{ETIQUETA[acta.estado] ?? acta.estado}</span>
                </td>
                <td>
                  {acta.estado === 'PENDIENTE_DE_FIRMA'
                    ? `${acta.plazoRestanteHoras ?? '—'} h`
                    : acta.estado === 'CERRADA_SIN_FIRMA'
                      ? 'Vencido'
                      : '—'}
                </td>
                <td>{acta.sellada ? 'Sellado' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibles.length === 0 && <p>No hay actas con este filtro.</p>}
      </article>

      <Form className="panel-tarjeta" layout="vertical" onFinish={generar} style={{ maxWidth: 640 }}>
        <h2>Generar acta</h2>
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
