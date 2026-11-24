import { Button, Input } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

type Vista = { numero: string; version: number; contenido: { trabajo?: { diagnostico?: string; estadoFinal?: string } } };

export function FirmarPage() {
  const { token = '' } = useParams();
  const [vista, setVista] = useState<Vista | null>(null);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    fetch(`/api/publico/firmar/${token}`)
      .then(async (respuesta) => {
        if (!respuesta.ok) {
          throw new Error('El enlace ya no sirve.');
        }
        return respuesta.json() as Promise<Vista>;
      })
      .then(setVista)
      .catch((error: unknown) => setAviso(error instanceof Error ? error.message : 'No se abrió el acta.'));
  }, [token]);

  async function enviar(ruta: string, body: object) {
    const respuesta = await fetch(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const cuerpo = (await respuesta.json()) as { error?: { message?: string }; codigo?: string };
    if (!respuesta.ok) {
      setAviso(cuerpo.error?.message ?? 'No se pudo registrar.');
      return;
    }
    setAviso(cuerpo.codigo ? `Firmada. Código ${cuerpo.codigo}.` : 'Quedó registrado. El enlace ya no sirve.');
  }

  return (
    <main className="login-panel">
      <h1>Firmar acta</h1>
      <p>Este enlace es de un solo uso y no pide tu contraseña. No es una firma digital certificada.</p>
      {aviso && <p className="aviso-db">{aviso}</p>}
      {vista && (
        <>
          <p>
            {vista.numero} · versión {vista.version}
          </p>
          <p>{vista.contenido.trabajo?.diagnostico}</p>
          <p>Estado final: {vista.contenido.trabajo?.estadoFinal}</p>
          <Button type="primary" onClick={() => enviar(`/api/publico/firmar/${token}`, {})}>
            Firmar
          </Button>
          <Input.TextArea style={{ marginTop: 12 }} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} placeholder="Motivo si no quedó resuelto" rows={2} />
          <Button danger style={{ marginTop: 8 }} onClick={() => enviar(`/api/publico/firmar/${token}/rechazar`, { motivo })}>
            Rechazar
          </Button>
        </>
      )}
    </main>
  );
}
