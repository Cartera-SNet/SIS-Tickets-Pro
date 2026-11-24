import { Button, Input } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorHttp, api } from '../api/http';

export function ActaDetallePage() {
  const { id = '' } = useParams();
  const [aviso, setAviso] = useState('');
  const [codigo, setCodigo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enlace, setEnlace] = useState('');
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas) {
      return;
    }
    const contexto = canvas.getContext('2d');
    if (!contexto) {
      return;
    }
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.strokeStyle = '#111111';
    let activo = false;
    const punto = (evento: PointerEvent) => {
      const recta = canvas.getBoundingClientRect();
      return { x: evento.clientX - recta.left, y: evento.clientY - recta.top };
    };
    const empezar = (evento: PointerEvent) => {
      activo = true;
      const p = punto(evento);
      contexto.beginPath();
      contexto.moveTo(p.x, p.y);
    };
    const mover = (evento: PointerEvent) => {
      if (!activo) {
        return;
      }
      const p = punto(evento);
      contexto.lineTo(p.x, p.y);
      contexto.stroke();
    };
    canvas.addEventListener('pointerdown', empezar);
    canvas.addEventListener('pointermove', mover);
    canvas.addEventListener('pointerup', () => {
      activo = false;
    });
  }, []);

  function imagen() {
    return lienzo.current?.toDataURL('image/png');
  }

  async function ejecutar(accion: () => Promise<void>) {
    try {
      await accion();
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se pudo completar la firma.');
    }
  }

  return (
    <section>
      <h1>Firma en el dispositivo</h1>
      <p>El técnico firma primero con su sesión. El solicitante digita el código de 6 dígitos, que vence en 5 minutos. Sin código no se firma. No es una firma digital certificada y no se reutiliza una firma guardada.</p>
      <p>
        <Link to="/actas">Volver a las actas</Link>
      </p>
      {aviso && <p className="aviso-db">{aviso}</p>}
      <canvas ref={lienzo} width={360} height={120} style={{ border: '1px solid #1e3040', background: '#fff', touchAction: 'none' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button
          type="primary"
          onClick={() =>
            ejecutar(async () => {
              await api(`/api/actas/${id}/firma-tecnico`, { method: 'POST', body: { imagen: imagen() } });
              setAviso('Firmaste como técnico. Ahora pide el código o crea el enlace.');
            })
          }
        >
          Firmar como técnico
        </Button>
        <Button
          onClick={() =>
            ejecutar(async () => {
              const cuerpo = await api<{ codigoPrueba?: string }>(`/api/actas/${id}/codigo`, { method: 'POST' });
              setAviso(cuerpo.codigoPrueba ? `Código de prueba: ${cuerpo.codigoPrueba}` : 'Código enviado.');
            })
          }
        >
          Pedir código
        </Button>
        <Button
          onClick={() =>
            ejecutar(async () => {
              const cuerpo = await api<{ url: string }>(`/api/actas/${id}/enlace`, { method: 'POST' });
              setEnlace(cuerpo.url);
              setAviso('Enlace de un solo uso, vence en 48 horas.');
            })
          }
        >
          Crear enlace
        </Button>
      </div>
      <Input style={{ marginTop: 12, maxWidth: 220 }} value={codigo} onChange={(evento) => setCodigo(evento.target.value)} placeholder="Código de 6 dígitos" />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button
          type="primary"
          onClick={() =>
            ejecutar(async () => {
              const cuerpo = await api<{ codigo: string }>(`/api/actas/${id}/firma-solicitante`, {
                method: 'POST',
                body: { codigo, imagen: imagen() },
              });
              setAviso(`Acta cerrada. Código ${cuerpo.codigo}.`);
            })
          }
        >
          Firmar solicitante
        </Button>
      </div>
      <Input.TextArea style={{ marginTop: 12 }} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} placeholder="Motivo si no quedó resuelto" rows={2} />
      <Button
        danger
        style={{ marginTop: 8 }}
        onClick={() =>
          ejecutar(async () => {
            await api(`/api/actas/${id}/rechazar`, { method: 'POST', body: { codigo, motivo } });
            setAviso('Firma rechazada. El caso volvió al técnico.');
          })
        }
      >
        Rechazar
      </Button>
      {enlace && (
        <p>
          <a href={enlace}>{enlace}</a>
        </p>
      )}
      <p>
        <a href={`/api/actas/${id}/pdf`}>Descargar PDF</a>
      </p>
    </section>
  );
}
