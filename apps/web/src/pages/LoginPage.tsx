import { Button, Form, Input, Select } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorHttp, api, prepararCsrf } from '../api/http';

type Servidor = { descripcion: string };
type Empresa = { cod: string; nombre: string; sede: string };
type UsuarioDev = { id: string; nombre: string; rol: string };

export function LoginPage() {
  const navigate = useNavigate();
  const [aviso, setAviso] = useState('');
  const [servidores, setServidores] = useState<Servidor[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioDev[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [token, setToken] = useState('');
  const [usuarioDev, setUsuarioDev] = useState<string>();

  useEffect(() => {
    prepararCsrf()
      .then(() => api<{ servidores: Servidor[] }>('/api/auth/servidores'))
      .then((cuerpo) => setServidores(cuerpo.servidores))
      .catch((error: unknown) => setAviso(texto(error)));
    api<UsuarioDev[]>('/api/auth/dev/usuarios')
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);

  async function entrarDev() {
    if (!usuarioDev) {
      return;
    }
    try {
      await api('/api/auth/dev/login', { method: 'POST', body: { usuarioId: usuarioDev } });
      navigate('/acceso');
    } catch (error) {
      setAviso(texto(error));
    }
  }

  async function conectar(valores: { servidor: string; usuario: string; password: string }) {
    try {
      const cuerpo = await api<{ token: string; empresas: Empresa[] }>('/api/auth/esculapio/conectar', {
        method: 'POST',
        body: valores,
      });
      setToken(cuerpo.token);
      setEmpresas(cuerpo.empresas);
      setAviso('');
    } catch (error) {
      setAviso(texto(error));
    }
  }

  async function elegirEmpresa(empresa: string) {
    try {
      await api('/api/auth/esculapio/login', { method: 'POST', body: { token, empresa } });
      navigate('/acceso');
    } catch (error) {
      setAviso(texto(error));
    }
  }

  async function gmail() {
    try {
      const inicio = await api<{ state: string; modo: string; url: string }>('/api/auth/google/iniciar', {
        method: 'POST',
      });
      if (inicio.modo === 'mock') {
        const callback = await api<{ token: string }>('/api/auth/google/callback', {
          method: 'POST',
          body: { state: inicio.state },
        });
        navigate(`/acceso?token=${encodeURIComponent(callback.token)}`);
        return;
      }
      window.location.assign(inicio.url);
    } catch (error) {
      setAviso(texto(error));
    }
  }

  return (
    <main className="login-panel">
      <div className="marca">
        <div className="marca-s" aria-hidden="true">
          S
        </div>
        <div>
          <strong>SIS</strong>
          <small>MESA DE AYUDA TI</small>
        </div>
      </div>
      <h1>Ingreso</h1>
      <p>Entra con tu usuario de Esculapio o con Gmail si no tienes uno.</p>
      {aviso && <p className="aviso-db">{aviso}</p>}
      {usuarios.length > 0 && (
        <section>
          <h2>Usuarios de prueba</h2>
          <Select
            style={{ width: '100%', marginBottom: 12 }}
            placeholder="Elige un usuario"
            options={usuarios.map((usuario) => ({ value: usuario.id, label: `${usuario.nombre} · ${usuario.rol}` }))}
            value={usuarioDev}
            onChange={setUsuarioDev}
          />
          <Button type="primary" onClick={entrarDev} block>
            Entrar como usuario de prueba
          </Button>
        </section>
      )}
      {empresas.length === 0 ? (
        <Form layout="vertical" onFinish={conectar} style={{ marginTop: 24 }}>
          <Form.Item name="servidor" label="Servidor" rules={[{ required: true, message: 'Elige el servidor' }]}>
            <Select options={servidores.map((servidor) => ({ value: servidor.descripcion, label: servidor.descripcion }))} />
          </Form.Item>
          <Form.Item name="usuario" label="Usuario" rules={[{ required: true, message: 'Escribe el usuario' }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="Contraseña" rules={[{ required: true, message: 'Escribe la contraseña' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Continuar
          </Button>
        </Form>
      ) : (
        <Form layout="vertical" onFinish={(valores: { empresa: string }) => elegirEmpresa(valores.empresa)}>
          <Form.Item name="empresa" label="Empresa y sede" rules={[{ required: true, message: 'Elige la empresa' }]}>
            <Select
              options={empresas.map((empresa) => ({
                value: empresa.cod,
                label: `${empresa.nombre} · ${empresa.sede}`,
              }))}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Entrar
          </Button>
        </Form>
      )}
      <Button style={{ marginTop: 16 }} onClick={gmail} block>
        Continuar con Gmail
      </Button>
    </main>
  );
}

function texto(error: unknown): string {
  return error instanceof ErrorHttp || error instanceof Error ? error.message : 'No se pudo completar el ingreso.';
}
