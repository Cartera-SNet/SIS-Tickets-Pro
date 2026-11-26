import { Button } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorHttp, api } from '../api/http';

type Equipo = { id: string; placa: string | null; serial: string | null; tipo: string; estado: string; sede: { nombre: string } | null };
type Plan = { id: string; nombre: string; tipoEquipo: string; frecuencia: string };
type Dia = { id: string; numero: string; fecha: string; estado: string; sede: string; tipo: string; tecnico: string };
type Medida = { programadas: number; conActa: number; porcentaje: number };

const ETIQUETA_ESTADO: Record<string, string> = {
  PROGRAMADA: 'Programado',
  ASIGNADA: 'Asignada',
  EN_EJECUCION: 'En ejecución',
  PENDIENTE_DE_FIRMA: 'Pendiente de firma',
  CERRADA_CON_ACTA: 'Ejecutado con acta',
  REPROGRAMADA: 'Reprogramada',
  VENCIDA: 'Vencido',
};

export function PreventivoPage() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [dias, setDias] = useState<Dia[]>([]);
  const [medida, setMedida] = useState<Medida | null>(null);
  const [aviso, setAviso] = useState('');
  const ahora = new Date();
  const mes = ahora.toISOString().slice(0, 7);
  const siguiente = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  const mesSiguiente = siguiente.toISOString().slice(0, 7);
  const nombreMes = ahora.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  function cargar() {
    api<Equipo[]>('/api/preventivo/equipos').then(setEquipos).catch(() => setEquipos([]));
    api<Plan[]>('/api/preventivo/planes').then(setPlanes).catch(() => setPlanes([]));
    Promise.all([
      api<Dia[]>(`/api/preventivo/calendario?mes=${mes}`),
      api<Dia[]>(`/api/preventivo/calendario?mes=${mesSiguiente}`),
    ])
      .then(([actual, proximo]) => setDias([...actual, ...proximo]))
      .catch(() => setDias([]));
    api<Medida>(`/api/preventivo/cumplimiento?desde=${mes}-01&hasta=${mesSiguiente}-01`)
      .then(setMedida)
      .catch(() => setMedida(null));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function generar() {
    try {
      const cuerpo = await api<{ creadas: string[] }>('/api/preventivo/generar', { method: 'POST' });
      setAviso(cuerpo.creadas.length ? `Órdenes: ${cuerpo.creadas.join(', ')}` : 'No había visitas dentro de la anticipación.');
      cargar();
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se generaron órdenes.');
    }
  }

  const celdas = useMemo(() => {
    const [anio, mesNum] = mes.split('-').map(Number);
    const inicio = new Date(anio, mesNum - 1, 1);
    const fin = new Date(anio, mesNum, 0);
    const offset = (inicio.getDay() + 6) % 7;
    const total = offset + fin.getDate();
    const semanas = Math.ceil(total / 7) * 7;
    const porDia = new Map<string, Dia[]>();
    for (const dia of dias) {
      const clave = new Date(dia.fecha).toISOString().slice(0, 10);
      const lista = porDia.get(clave) ?? [];
      lista.push(dia);
      porDia.set(clave, lista);
    }
    return Array.from({ length: semanas }, (_, indice) => {
      const diaMes = indice - offset + 1;
      if (diaMes < 1 || diaMes > fin.getDate()) {
        return { clave: `vacio-${indice}`, numero: 0, items: [] as Dia[] };
      }
      const fecha = new Date(anio, mesNum - 1, diaMes);
      const clave = fecha.toISOString().slice(0, 10);
      return { clave, numero: diaMes, items: porDia.get(clave) ?? [] };
    });
  }, [dias, mes]);

  const vencidos = dias.filter((d) => d.estado === 'VENCIDA').length;
  const ejecutados = dias.filter((d) => d.estado === 'CERRADA_CON_ACTA').length;

  return (
    <section>
      <div className="pagina-cabecera">
        <div>
          <h1>Mantenimiento preventivo · {nombreMes}</h1>
          <p>Equipos de TI · inventario, planes y calendario. Sin inventario no hay planes.</p>
        </div>
        <Button type="primary" onClick={() => void generar()}>
          Generar órdenes
        </Button>
      </div>

      {aviso && <p className="aviso-db">{aviso}</p>}

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <article className="kpi azul">
          <span>Programados</span>
          <strong>{medida?.programadas ?? dias.length}</strong>
        </article>
        <article className="kpi verde">
          <span>Ejecutados</span>
          <strong>{medida?.conActa ?? ejecutados}</strong>
        </article>
        <article className="kpi">
          <span>Cumplimiento del plan</span>
          <strong>{medida?.porcentaje ?? 0}%</strong>
        </article>
        <article className="kpi" style={{ borderLeftColor: 'var(--danger)' }}>
          <span>Vencidos</span>
          <strong>{vencidos}</strong>
        </article>
      </div>

      <div className="panel-rejilla">
        <article className="panel-tarjeta">
          <h2>Calendario</h2>
          <div className="calendario-mes" aria-label="Calendario del mes">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia) => (
              <div key={dia} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 6px' }}>
                {dia}
              </div>
            ))}
            {celdas.map((celda) => (
              <div key={celda.clave} className="calendario-dia">
                {celda.numero > 0 && <header>{celda.numero}</header>}
                {celda.items.map((item) => (
                  <Link key={item.id} className={`cal-${item.estado}`} to={`/preventivo/ordenes/${item.id}`} title={`${item.numero} · ${item.tipo}`}>
                    {item.tipo}
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--sis-texto-suave)' }}>
            {Object.values(ETIQUETA_ESTADO).slice(0, 5).join(' · ')}
          </p>
        </article>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <article className="panel-tarjeta">
            <h2>Planes</h2>
            <table className="tabla-sis">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Tipo</th>
                  <th>Frecuencia</th>
                </tr>
              </thead>
              <tbody>
                {planes.map((plan) => (
                  <tr key={plan.id}>
                    <td>{plan.nombre}</td>
                    <td>{plan.tipoEquipo}</td>
                    <td>{plan.frecuencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {planes.length === 0 && <p>Sin planes configurados.</p>}
          </article>

          <article className="panel-tarjeta">
            <h2>Inventario</h2>
            <table className="tabla-sis">
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Tipo</th>
                  <th>Sede</th>
                </tr>
              </thead>
              <tbody>
                {equipos.slice(0, 8).map((equipo) => (
                  <tr key={equipo.id}>
                    <td>
                      <Link to={`/preventivo/equipos/${equipo.id}`}>{equipo.placa ?? equipo.serial ?? 'Sin placa'}</Link>
                    </td>
                    <td>{equipo.tipo}</td>
                    <td>{equipo.sede?.nombre ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {equipos.length === 0 && <p>Sin equipos en inventario.</p>}
          </article>
        </div>
      </div>
    </section>
  );
}
