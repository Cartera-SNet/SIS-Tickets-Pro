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
    const soltar = () => {
      activo = false;
    };
    canvas.addEventListener('pointerdown', empezar);
    canvas.addEventListener('pointermove', mover);
    canvas.addEventListener('pointerup', soltar);
    return () => {
      canvas.removeEventListener('pointerdown', empezar);
      canvas.removeEventListener('pointermove', mover);
      canvas.removeEventListener('pointerup', soltar);
    };
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
      <div className="pagina-cabecera">
        <div>
          <h1>Firma presencial del acta</h1>
          <p>Opción A: el técnico firma primero; el solicitante confirma con el código de WhatsApp (5 min).</p>
        </div>
        <Link to="/actas">Volver a las actas</Link>
      </div>

      {aviso && <p className="aviso-db">{aviso}</p>}

      <div className="detalle-dos">
        <article className="panel-tarjeta">
          <h2>Paso 1 · técnico</h2>
          <p>Firma con tu sesión. Sin esta firma no se pasa al solicitante.</p>
          <canvas ref={lienzo} className="firma-lienzo" width={420} height={140} aria-label="Lienzo de firma" />
          <div className="filtros-fila" style={{ marginTop: 12 }}>
            <Button
              type="primary"
              onClick={() =>
                void ejecutar(async () => {
                  await api(`/api/actas/${id}/firma-tecnico`, { method: 'POST', body: { imagen: imagen() } });
                  setAviso('Firmaste como técnico. Ahora pide el código o crea el enlace.');
                })
              }
            >
              Firmar como técnico
            </Button>
            <Button
              onClick={() =>
                void ejecutar(async () => {
                  const cuerpo = await api<{ codigoPrueba?: string }>(`/api/actas/${id}/codigo`, { method: 'POST' });
                  setAviso(cuerpo.codigoPrueba ? `Código de prueba: ${cuerpo.codigoPrueba}` : 'Código enviado.');
                })
              }
            >
              Pedir código WhatsApp
            </Button>
            <Button
              onClick={() =>
                void ejecutar(async () => {
                  const cuerpo = await api<{ url: string }>(`/api/actas/${id}/enlace`, { method: 'POST' });
                  setEnlace(cuerpo.url);
                  setAviso('Enlace de un solo uso, vence en 48 horas.');
                })
              }
            >
              Crear enlace (opción B)
            </Button>
          </div>
        </article>

        <article className="panel-tarjeta">
          <h2>Paso 2 · solicitante</h2>
          <p>En el mismo dispositivo. El código prueba la identidad; la traza sola no basta.</p>
          <Input
            style={{ maxWidth: 220, marginBottom: 12 }}
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value)}
            placeholder="Código de 6 dígitos"
            maxLength={6}
          />
          <Input.TextArea
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Observaciones o motivo si no quedó resuelto"
            rows={3}
            style={{ marginBottom: 12 }}
          />
          <div className="filtros-fila">
            <Button
              type="primary"
              onClick={() =>
                void ejecutar(async () => {
                  const cuerpo = await api<{ codigo: string }>(`/api/actas/${id}/firma-solicitante`, {
                    method: 'POST',
                    body: { codigo, imagen: imagen() },
                  });
                  setAviso(`Acta cerrada. Código ${cuerpo.codigo}.`);
                })
              }
            >
              Firmar y cerrar
            </Button>
            <Button
              danger
              onClick={() =>
                void ejecutar(async () => {
                  await api(`/api/actas/${id}/rechazar`, { method: 'POST', body: { codigo, motivo } });
                  setAviso('Firma rechazada. El caso volvió al técnico.');
                })
              }
            >
              No quedó resuelto
            </Button>
          </div>
          {enlace && (
            <p style={{ marginTop: 12 }}>
              Enlace: <a href={enlace}>{enlace}</a>
            </p>
          )}
          <p style={{ marginTop: 12 }}>
            <a href={`/api/actas/${id}/pdf`}>Descargar PDF</a>
          </p>
        </article>
      </div>
    </section>
  );
}
