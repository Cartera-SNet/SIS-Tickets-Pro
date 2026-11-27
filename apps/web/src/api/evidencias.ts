import { ErrorHttp, api } from './http';

export type EvidenciaBase64 = {
  id: string;
  nombre: string;
  mime: string;
  tamano: number;
  base64: string;
  dataUrl: string;
};

function tokenCsrf(): string | null {
  const coincidencia = document.cookie.match(/(?:^|; )sis_csrf=([^;]*)/);
  return coincidencia ? decodeURIComponent(coincidencia[1]) : null;
}

/** Lee un File del navegador y lo deja en base64 (sin prefijo data:). */
export function archivoABase64(archivo: File): Promise<{ nombre: string; mime: string; base64: string; tamano: number }> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
    lector.onload = () => {
      const resultado = String(lector.result ?? '');
      const coma = resultado.indexOf(',');
      const base64 = coma >= 0 ? resultado.slice(coma + 1) : resultado;
      resolver({
        nombre: archivo.name,
        mime: archivo.type || 'application/octet-stream',
        base64,
        tamano: archivo.size,
      });
    };
    lector.readAsDataURL(archivo);
  });
}

async function leerError(respuesta: Response): Promise<string> {
  try {
    const cuerpo = (await respuesta.json()) as { error?: { message?: string } };
    return cuerpo?.error?.message ?? `La solicitud respondió ${respuesta.status}`;
  } catch {
    return `La solicitud respondió ${respuesta.status}`;
  }
}

/** Preferido para el chat: multipart (no se queda corto el límite JSON). */
export async function subirEvidenciaMultipart(
  ticketId: string,
  archivo: File,
  mensaje?: string,
): Promise<{ id: string; nombre: string; tamano: number; mime: string; subidoPorId?: string | null; mensaje?: unknown }> {
  const datos = new FormData();
  datos.append('archivo', archivo, archivo.name);
  if (mensaje?.trim()) {
    datos.append('mensaje', mensaje.trim());
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  const csrf = tokenCsrf();
  if (csrf) {
    headers['x-csrf-token'] = csrf;
  }
  const respuesta = await fetch(`/api/tickets/${ticketId}/adjuntos/multipart`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: datos,
  });
  if (!respuesta.ok) {
    throw new ErrorHttp(respuesta.status, await leerError(respuesta));
  }
  return (await respuesta.json()) as {
    id: string;
    nombre: string;
    tamano: number;
    mime: string;
    subidoPorId?: string | null;
    mensaje?: unknown;
  };
}

/** Respaldo JSON+base64 (archivos pequeños o si multipart falla). */
export async function subirEvidenciaJson(
  ticketId: string,
  archivo: File,
  mensaje?: string,
): Promise<{ id: string; nombre: string; tamano: number; mime: string; subidoPorId?: string | null; mensaje?: unknown }> {
  const payload = await archivoABase64(archivo);
  return api(`/api/tickets/${ticketId}/adjuntos`, {
    method: 'POST',
    body: {
      nombre: payload.nombre,
      mime: payload.mime,
      base64: payload.base64,
      mensaje: mensaje || undefined,
    },
  });
}

/** Sube evidencia al chat/ticket: multipart primero; si falla, base64. */
export async function subirEvidenciaBase64(
  ticketId: string,
  archivo: File,
  mensaje?: string,
): Promise<{ id: string; nombre: string; tamano: number; mime: string; subidoPorId?: string | null; mensaje?: unknown }> {
  try {
    return await subirEvidenciaMultipart(ticketId, archivo, mensaje);
  } catch (error) {
    if (error instanceof ErrorHttp && (error.status === 404 || error.status === 405)) {
      return subirEvidenciaJson(ticketId, archivo, mensaje);
    }
    // Si el proxy rechaza multipart, intenta base64 (ya con límite 8mb en API).
    if (error instanceof ErrorHttp && error.status >= 500) {
      try {
        return await subirEvidenciaJson(ticketId, archivo, mensaje);
      } catch {
        throw error;
      }
    }
    throw error;
  }
}

/** Consulta la evidencia en Neon vía Railway y la devuelve como data URL. */
export async function consultarEvidenciaBase64(ticketId: string, adjuntoId: string): Promise<EvidenciaBase64> {
  const cuerpo = await api<Omit<EvidenciaBase64, 'dataUrl'>>(
    `/api/tickets/${ticketId}/adjuntos/${adjuntoId}?formato=base64`,
  );
  if (!cuerpo.base64) {
    throw new ErrorHttp(404, 'La evidencia no tiene contenido en Neon.');
  }
  return {
    ...cuerpo,
    dataUrl: `data:${cuerpo.mime || 'application/octet-stream'};base64,${cuerpo.base64}`,
  };
}

/** Descarga local desde el base64 (para el botón Descargar). */
export async function descargarEvidenciaBase64(ticketId: string, adjuntoId: string, nombre: string) {
  const evidencia = await consultarEvidenciaBase64(ticketId, adjuntoId);
  const binario = atob(evidencia.base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: evidencia.mime });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre || evidencia.nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

export function csrfEvidencias() {
  return tokenCsrf();
}
