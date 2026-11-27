const ORDEN = { N1: 1, N2: 2, N3: 3 } as const;
export type Nivel = keyof typeof ORDEN;

export function validarEscalamiento(entrada: {
  nivelActual: Nivel;
  nivelDestino: Nivel;
  motivo: string;
  acciones: string;
  responsableId: string;
  areaCompleta: boolean;
}): { ok: true; devolucion: false } | { ok: false; mensaje: string } {
  if (!entrada.motivo.trim() || !entrada.acciones.trim() || !entrada.responsableId.trim()) {
    return { ok: false, mensaje: 'Para escalar hacen falta el motivo, las acciones realizadas y el responsable asignado.' };
  }
  const actual = ORDEN[entrada.nivelActual];
  const destino = ORDEN[entrada.nivelDestino];
  if (actual === destino) {
    return { ok: false, mensaje: 'El caso ya está en ese nivel.' };
  }
  if (destino < actual) {
    return { ok: false, mensaje: 'Solo se permite escalar a un nivel superior. La devolución ya no está disponible.' };
  }
  if (entrada.nivelActual === 'N2' && entrada.nivelDestino !== 'N3') {
    return { ok: false, mensaje: 'Desde N2 solo se puede escalar a N3.' };
  }
  if (destino > actual + 1 && !entrada.areaCompleta) {
    return { ok: false, mensaje: 'Solo se salta de N1 a N3 cuando el área completa está afectada.' };
  }
  if (entrada.nivelActual === 'N3') {
    return { ok: false, mensaje: 'N3 no tiene un nivel superior.' };
  }
  return { ok: true, devolucion: false };
}

export function agentePuedeCerrar(tieneEscalamientos: boolean): boolean {
  return !tieneEscalamientos;
}
