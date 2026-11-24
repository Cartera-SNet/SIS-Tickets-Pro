import { Button, Input } from 'antd';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

type Resultado = {
  autentico: boolean;
  codigo?: string;
  hash?: string;
  firmas?: { nombre: string; rol: string; metodo: string; fecha: string }[];
};

export function VerificarPage() {
  const [params] = useSearchParams();
  const [codigo, setCodigo] = useState(params.get('codigo') ?? '');
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function consultar(valor = codigo) {
    const respuesta = await fetch(`/api/publico/verificar?codigo=${encodeURIComponent(valor.trim())}`);
    setResultado((await respuesta.json()) as Resultado);
  }

  return (
    <main className="login-panel">
      <h1>Verificar acta</h1>
      <p>Confirma el código del PDF. Esta página no muestra el diagnóstico ni datos del caso.</p>
      <Input value={codigo} onChange={(evento) => setCodigo(evento.target.value)} placeholder="7F3A-91C2" />
      <Button type="primary" style={{ marginTop: 12 }} onClick={() => consultar()}>
        Verificar
      </Button>
      {params.get('codigo') && !resultado && (
        <Button style={{ marginLeft: 8 }} onClick={() => consultar(params.get('codigo') ?? '')}>
          Usar el código del enlace
        </Button>
      )}
      {resultado && (
        <section>
          <p>{resultado.autentico ? 'El documento coincide con el hash guardado.' : 'No hay un acta auténtica con ese código.'}</p>
          {resultado.autentico && (
            <>
              <p>Código {resultado.codigo}</p>
              <p>SHA-256 {resultado.hash}</p>
              <ul>
                {(resultado.firmas ?? []).map((firma) => (
                  <li key={`${firma.rol}-${firma.fecha}`}>
                    {firma.nombre} · {firma.rol} · {firma.metodo}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </main>
  );
}
