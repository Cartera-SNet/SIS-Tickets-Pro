export const ESTADOS_TICKET = [
  'NUEVO',
  'EN_ATENCION_N1',
  'ESCALADO',
  'ASIGNADO',
  'EN_SITIO',
  'EN_PROCESO',
  'ESPERANDO_USUARIO',
  'ESPERANDO_REPUESTO',
  'RESUELTO',
  'CERRADO',
  'PENDIENTE_DE_FIRMA',
  'CERRADO_CON_ACTA',
  'CERRADO_SIN_FIRMA',
  'FIRMA_RECHAZADA',
  'DESCARTADO',
  'CANCELADO',
  'REABIERTO',
] as const;

export type EstadoTicket = (typeof ESTADOS_TICKET)[number];

const TRANSICIONES: Record<EstadoTicket, readonly EstadoTicket[]> = {
  NUEVO: ['EN_ATENCION_N1', 'CANCELADO', 'DESCARTADO'],
  EN_ATENCION_N1: ['ESCALADO', 'RESUELTO', 'ESPERANDO_USUARIO', 'DESCARTADO', 'CANCELADO'],
  ESCALADO: ['ASIGNADO', 'CANCELADO'],
  ASIGNADO: ['EN_SITIO', 'EN_PROCESO', 'ESPERANDO_USUARIO', 'ESPERANDO_REPUESTO', 'CANCELADO'],
  EN_SITIO: ['EN_PROCESO', 'ESPERANDO_USUARIO', 'ESPERANDO_REPUESTO', 'RESUELTO', 'CANCELADO'],
  EN_PROCESO: ['EN_SITIO', 'ESPERANDO_USUARIO', 'ESPERANDO_REPUESTO', 'RESUELTO', 'CANCELADO'],
  ESPERANDO_USUARIO: ['EN_ATENCION_N1', 'EN_PROCESO', 'EN_SITIO', 'CANCELADO'],
  ESPERANDO_REPUESTO: ['EN_PROCESO', 'EN_SITIO', 'CANCELADO'],
  RESUELTO: ['CERRADO', 'PENDIENTE_DE_FIRMA', 'REABIERTO'],
  PENDIENTE_DE_FIRMA: ['CERRADO_CON_ACTA', 'CERRADO_SIN_FIRMA', 'FIRMA_RECHAZADA'],
  FIRMA_RECHAZADA: ['EN_SITIO'],
  REABIERTO: ['EN_ATENCION_N1', 'EN_SITIO', 'EN_PROCESO'],
  DESCARTADO: ['REABIERTO'],
  CANCELADO: [],
  CERRADO: ['REABIERTO'],
  CERRADO_CON_ACTA: [],
  CERRADO_SIN_FIRMA: [],
};

export type ContextoTransicion = {
  solucionAplicada?: string | null;
  motivo?: string | null;
  estuvoEnSitio: boolean;
  actaFirmada: boolean;
  plazoFirmaVencido: boolean;
};

export function puedeTransicionar(
  origen: EstadoTicket,
  destino: EstadoTicket,
  contexto: ContextoTransicion,
): { ok: true } | { ok: false; mensaje: string } {
  if (!TRANSICIONES[origen].includes(destino)) {
    return { ok: false, mensaje: 'Ese cambio de estado no está permitido.' };
  }
  if (destino === 'RESUELTO' && !contexto.solucionAplicada?.trim()) {
    return { ok: false, mensaje: 'Para resolver hay que registrar la solución aplicada.' };
  }
  if (destino === 'DESCARTADO' && !contexto.motivo?.trim()) {
    return { ok: false, mensaje: 'El descarte exige un motivo.' };
  }
  if (destino === 'CERRADO' && contexto.estuvoEnSitio) {
    return { ok: false, mensaje: 'Un caso atendido en sitio se cierra con acta, no con confirmación simple.' };
  }
  if (destino === 'PENDIENTE_DE_FIRMA' && !contexto.estuvoEnSitio) {
    return { ok: false, mensaje: 'La firma solo aplica a una atención en sitio.' };
  }
  if (destino === 'CERRADO_CON_ACTA' && !contexto.actaFirmada) {
    return { ok: false, mensaje: 'No se puede cerrar con acta sin la firma.' };
  }
  if (destino === 'CERRADO_SIN_FIRMA' && !contexto.plazoFirmaVencido) {
    return { ok: false, mensaje: 'Solo se cierra sin firma cuando vence el plazo.' };
  }
  return { ok: true };
}
