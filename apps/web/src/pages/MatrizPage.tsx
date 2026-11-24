import { Button, Select } from 'antd';
import { useEffect, useState } from 'react';
import { ErrorHttp, api } from '../api/http';

type Fila = { evento: string; web: 'si' | 'no' | 'opcional'; whatsapp: 'si' | 'no' | 'opcional'; correo: 'si' | 'no' | 'opcional' };

const OPCIONES = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'opcional', label: 'Opcional' },
];

export function MatrizPage() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    api<Fila[]>('/api/notificaciones/matriz')
      .then(setFilas)
      .catch((error: unknown) => setAviso(error instanceof ErrorHttp ? error.message : 'No se cargó la matriz.'));
  }, []);

  function cambiar(indice: number, canal: 'web' | 'whatsapp' | 'correo', valor: Fila['web']) {
    setFilas((actual) => actual.map((fila, i) => (i === indice ? { ...fila, [canal]: valor } : fila)));
  }

  async function guardar() {
    try {
      const guardada = await api<Fila[]>('/api/notificaciones/matriz', { method: 'PUT', body: filas });
      setFilas(guardada);
      setAviso('Matriz guardada y auditada.');
    } catch (error) {
      setAviso(error instanceof ErrorHttp ? error.message : 'No se guardó.');
    }
  }

  return (
    <section>
      <h1>Matriz de avisos</h1>
      <p>Quince eventos. Quien no tiene celular verificado recibe por web y por correo lo que iba a WhatsApp.</p>
      {aviso && <p className="aviso-db">{aviso}</p>}
      <table>
        <thead>
          <tr>
            <th>Evento</th>
            <th>Web</th>
            <th>WhatsApp</th>
            <th>Correo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, indice) => (
            <tr key={fila.evento}>
              <td>{fila.evento}</td>
              <td>
                <Select value={fila.web} options={OPCIONES} onChange={(valor) => cambiar(indice, 'web', valor)} />
              </td>
              <td>
                <Select value={fila.whatsapp} options={OPCIONES} onChange={(valor) => cambiar(indice, 'whatsapp', valor)} />
              </td>
              <td>
                <Select value={fila.correo} options={OPCIONES} onChange={(valor) => cambiar(indice, 'correo', valor)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button type="primary" onClick={guardar} style={{ marginTop: 12 }}>
        Guardar matriz
      </Button>
    </section>
  );
}
