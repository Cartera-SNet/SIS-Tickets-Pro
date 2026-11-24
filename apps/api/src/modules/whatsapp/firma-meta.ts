import { createHmac, timingSafeEqual } from 'node:crypto';

export function firmaMetaValida(cuerpo: Buffer, encabezado: string | undefined, secreto: string): boolean {
  if (!encabezado || !secreto || !encabezado.startsWith('sha256=')) {
    return false;
  }
  const esperado = createHmac('sha256', secreto).update(cuerpo).digest('hex');
  const recibido = encabezado.slice('sha256='.length);
  const a = Buffer.from(esperado);
  const b = Buffer.from(recibido);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function soloPlantilla(ultimoMensaje: Date | null, ahora: Date): boolean {
  if (!ultimoMensaje) {
    return true;
  }
  return ahora.getTime() - ultimoMensaje.getTime() > 24 * 60 * 60 * 1000;
}

export const HERRAMIENTAS_AGENTE = [
  'crear_ticket',
  'consultar_estado_tickets_del_usuario',
  'buscar_articulo_kb',
  'escalar',
  'transferir_a_analista',
  'descartar_software',
  'solicitar_confirmacion_y_calificacion',
] as const;

export function esHerramientaCerrada(nombre: string): boolean {
  return (HERRAMIENTAS_AGENTE as readonly string[]).includes(nombre);
}
