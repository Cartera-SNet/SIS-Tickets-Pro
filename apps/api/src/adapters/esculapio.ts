import type { Entorno } from '../config/entorno';
import { redactarSecretos } from './redactar-url';
import type { CredencialesEsculapio, EmpresaEsculapio, EsculapioClient, ServidorEsculapio } from './contratos';

const SERVIDOR_FICTICIO: ServidorEsculapio = {
  $id: '1',
  Descripcion: 'Servidor de prueba',
  Ip_Conexion: '10.0.0.10',
  Puerto: 3306,
  Usuario: 'consulta',
};

export class EsculapioMock implements EsculapioClient {
  readonly modo = 'mock' as const;

  async obtenerServidores(): Promise<ServidorEsculapio[]> {
    return [SERVIDOR_FICTICIO];
  }

  async obtenerEmpresas(credenciales: CredencialesEsculapio): Promise<EmpresaEsculapio[]> {
    if (!credenciales.password || credenciales.password === 'invalida') {
      return [];
    }
    return [{ cod: '01', nombre: 'Clínica Ejemplo', sede: 'Sede Norte' }];
  }
}

export class EsculapioReal implements EsculapioClient {
  readonly modo = 'real' as const;
  private cache: { at: number; datos: ServidorEsculapio[] } | null = null;

  constructor(private readonly baseUrl: string) {}

  async obtenerServidores(): Promise<ServidorEsculapio[]> {
    if (this.cache && Date.now() - this.cache.at < 5 * 60 * 1000) {
      return this.cache.datos;
    }
    try {
      const datos = await this.pedir('obtener-servidores');
      const lista = Array.isArray(datos) ? (datos as ServidorEsculapio[]) : [];
      this.cache = { at: Date.now(), datos: lista };
      return lista;
    } catch (error) {
      if (this.cache) {
        return this.cache.datos;
      }
      throw error;
    }
  }

  async obtenerEmpresas(credenciales: CredencialesEsculapio): Promise<EmpresaEsculapio[]> {
    const params = new URLSearchParams({
      IpConexion: credenciales.ipConexion,
      BdConexion: 'bd',
      PortConexion: String(credenciales.puerto),
      Usuario: credenciales.usuario,
      PasswordUsu: credenciales.password,
    });
    const datos = await this.pedir(`obtener-empresas?${params.toString()}`);
    if (!Array.isArray(datos)) {
      return [];
    }
    return datos.map((fila: { Empresa?: string; Nombre_Empresa?: string; NombreComercial?: string }) => ({
      cod: String(fila.Empresa ?? ''),
      nombre: String(fila.Nombre_Empresa ?? ''),
      sede: String(fila.NombreComercial ?? ''),
    }));
  }

  private async pedir(ruta: string): Promise<unknown> {
    const url = new URL(ruta, asegurarBarra(this.baseUrl)).toString();
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 10_000);
    try {
      const respuesta = await fetch(url, { signal: controlador.signal });
      if (!respuesta.ok) {
        const texto = redactarSecretos(await respuesta.text()).slice(0, 300);
        throw new Error(`Esculapio respondió ${respuesta.status} en ${ruta.split('?')[0]}: ${texto}`);
      }
      return (await respuesta.json()) as unknown;
    } catch (error) {
      const mensaje = error instanceof Error ? redactarSecretos(error.message) : 'fallo de red';
      throw new Error(`No se pudo consultar Esculapio (${ruta.split('?')[0]}): ${mensaje}`);
    } finally {
      clearTimeout(temporizador);
    }
  }
}

function asegurarBarra(base: string): string {
  return base.endsWith('/') ? base : `${base}/`;
}

export function crearEsculapio(entorno: Entorno): EsculapioClient {
  if (entorno.esculapioMode === 'real') {
    return new EsculapioReal(entorno.esculapioBaseUrl);
  }
  return new EsculapioMock();
}
