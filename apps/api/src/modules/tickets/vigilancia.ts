const CERRADOS = new Set(['CERRADO', 'CERRADO_CON_ACTA', 'CERRADO_SIN_FIRMA', 'CANCELADO', 'DESCARTADO']);

export function estaPorVencer(objetivo: Date, ahora: Date, anticipacionMinutos: number, estado: string): boolean {
  if (CERRADOS.has(estado)) {
    return false;
  }
  const inicio = objetivo.getTime() - anticipacionMinutos * 60_000;
  return ahora.getTime() >= inicio && ahora.getTime() < objetivo.getTime();
}

/** Tras el plazo sin confirmación del solicitante, el caso pasa a Cerrado. */
export function debeCerrarSinConfirmacion(
  estado: string,
  fechaResolucion: Date | null,
  ahora: Date,
  horas: number,
): boolean {
  if (estado !== 'RESUELTO' || !fechaResolucion) {
    return false;
  }
  return ahora.getTime() - fechaResolucion.getTime() >= horas * 3_600_000;
}

/** @deprecated Usar debeCerrarSinConfirmacion. Se mantiene por compatibilidad de imports. */
export function debeReabrirSinConfirmacion(
  estado: string,
  _estuvoEnSitio: boolean,
  fechaResolucion: Date | null,
  ahora: Date,
  horas: number,
): boolean {
  return debeCerrarSinConfirmacion(estado, fechaResolucion, ahora, horas);
}
