export const ETIQUETA_ESTADO: Record<string, string> = {
  NUEVO: 'Nuevo',
  EN_ATENCION_N1: 'En atención N1',
  ESCALADO: 'Escalado',
  ASIGNADO: 'Asignado',
  EN_SITIO: 'En sitio',
  EN_PROCESO: 'En proceso',
  ESPERANDO_USUARIO: 'Esperando usuario',
  ESPERANDO_REPUESTO: 'Esperando repuesto',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
  PENDIENTE_DE_FIRMA: 'Pendiente de firma',
  CERRADO_CON_ACTA: 'Cerrado con acta',
  CERRADO_SIN_FIRMA: 'Cerrado sin firma',
  FIRMA_RECHAZADA: 'Firma rechazada',
  DESCARTADO: 'Descartado',
  CANCELADO: 'Cancelado',
  REABIERTO: 'Reabierto',
};

export function claseNivel(nivel: string): string {
  if (nivel === 'N1') return 'chip chip-n1';
  if (nivel === 'N2') return 'chip chip-n2';
  if (nivel === 'N3') return 'chip chip-n3';
  return 'chip';
}

export function claseEstado(estado: string): string {
  const clave = estado.toUpperCase();
  if (clave.includes('RESUELTO') || clave.includes('CERRADO_CON') || clave === 'CERRADO') return 'chip chip-ok';
  if (clave.includes('DESCART') || clave.includes('RECHAZ') || clave.includes('FIRMA_RECHAZADA')) return 'chip chip-peligro';
  if (clave.includes('SITIO') || clave.includes('PROCESO') || clave.includes('ESPERANDO') || clave.includes('PENDIENTE')) {
    return 'chip chip-aviso';
  }
  if (clave.includes('NUEVO') || clave.includes('ATENCION') || clave.includes('ASIGNADO') || clave.includes('ESCALADO')) {
    return 'chip chip-info';
  }
  return 'chip';
}

export function etiquetaEstado(codigo: string, nombre?: string): string {
  return nombre || ETIQUETA_ESTADO[codigo] || codigo;
}

export function restanteAns(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const ms = new Date(fecha).getTime() - Date.now();
  if (Number.isNaN(ms)) return '—';
  if (ms <= 0) return 'Vencido';
  const minutos = Math.round(ms / 60000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas < 48) return resto ? `${horas} h ${resto} min` : `${horas} h`;
  return `${Math.floor(horas / 24)} d`;
}

export function claseAns(fecha: string | null | undefined): string {
  if (!fecha) return '';
  const ms = new Date(fecha).getTime() - Date.now();
  if (ms <= 0) return 'ans-vencido';
  if (ms < 2 * 3600000) return 'ans-critico';
  if (ms < 24 * 3600000) return 'ans-cerca';
  return 'ans-ok';
}
