export class ErrorHttp extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function tokenCsrf(): string | null {
  const coincidencia = document.cookie.match(/(?:^|; )sis_csrf=([^;]*)/);
  return coincidencia ? decodeURIComponent(coincidencia[1]) : null;
}

export async function api<T>(ruta: string, opciones: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opciones.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opciones.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET') {
    const csrf = tokenCsrf();
    if (csrf) {
      headers['x-csrf-token'] = csrf;
    }
  }
  const respuesta = await fetch(ruta, {
    method,
    credentials: 'include',
    headers,
    body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
  });
  const texto = await respuesta.text();
  const cuerpo = texto ? (JSON.parse(texto) as { error?: { message?: string } }) : null;
  if (!respuesta.ok) {
    throw new ErrorHttp(respuesta.status, cuerpo?.error?.message ?? `La solicitud respondió ${respuesta.status}`);
  }
  return cuerpo as T;
}

export function obtenerJson<T>(ruta: string): Promise<T> {
  return api<T>(ruta);
}

export async function prepararCsrf(): Promise<void> {
  await api('/api/auth/csrf');
}

export type Sesion = {
  id: string;
  nombre: string;
  rol: string;
  sedeNombre: string | null;
  estadoAprobacion: string;
  permisos: string[];
  faltaPerfil: boolean;
  puedeEntrar: boolean;
  celularPermitido: boolean;
  celularVerificado: boolean;
  correoNotificaciones: string | null;
};
