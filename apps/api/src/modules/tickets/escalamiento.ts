const ORDEN = { N1: 1, N2: 2, N3: 3 } as const;
export type Nivel = keyof typeof ORDEN;

export function validarEscalamiento(entrada: {
  nivelActual: Nivel;
  nivelDestino: Nivel;
  motivo: string;
  acciones: string;
  responsableId: string;
  areaCompleta: boolean;
}): { ok: true; devolucion: boolean } | { ok: false; mensaje: string } {
  if (!entrada.motivo.trim() || !entrada.acciones.trim() || !entrada.responsableId.trim()) {
    return { ok: false, mensaje: 'Para escalar o devolver hacen falta el motivo, las acciones y el responsable.' };
  }
  const actual = ORDEN[entrada.nivelActual];
  const destino = ORDEN[entrada.nivelDestino];
  if (actual === destino) {
    return { ok: false, mensaje: 'El caso ya está en ese nivel.' };
  }
  if (destino > actual + 1 && !entrada.areaCompleta) {
    return { ok: false, mensaje: 'Solo se salta de N1 a N3 cuando el área completa está afectada.' };
  }
  if (destino > actual && entrada.nivelActual === 'N3') {
    return { ok: false, mensaje: 'N3 no tiene un nivel superior.' };
  }
  return { ok: true, devolucion: destino < actual };
}

export function agentePuedeCerrar(tieneEscalamientos: boolean): boolean {
  return !tieneEscalamientos;
}
