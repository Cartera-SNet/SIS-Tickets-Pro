import { useEffect, useState } from 'react';
import { ErrorHttp, api } from '../api/http';

type Plantilla = { id: string; nombre: string; contenido: string; idioma: string; estadoAprobacion: string };

export function PlantillasPage() {
  const [filas, setFilas] = useState<Plantilla[]>([]);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    api<Plantilla[]>('/api/whatsapp/plantillas')
      .then(setFilas)
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se cargaron las plantillas.'));
  }, []);

  return (
    <section>
      <h1>Plantillas de WhatsApp</h1>
      <p>El estado es el de aprobación en Meta. El contenido no sale del servidor hacia otro canal.</p>
      {aviso && <p className="aviso-db">{aviso}</p>}
      <ul>
        {filas.map((fila) => (
          <li key={fila.id}>
            <strong>{fila.nombre}</strong> · {fila.idioma} · {fila.estadoAprobacion}
            <p>{fila.contenido}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
