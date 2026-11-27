import { agentePuedeCerrar, validarEscalamiento } from './escalamiento';

describe('escalamiento', () => {
  const base = {
    nivelActual: 'N1' as const,
    nivelDestino: 'N2' as const,
    motivo: 'Hay que ir al puesto',
    acciones: 'Reinicié el equipo',
    responsableId: 'luis',
    areaCompleta: false,
  };

  it('no escala sin motivo, acciones y responsable', () => {
    expect(validarEscalamiento({ ...base, motivo: ' ' }).ok).toBe(false);
  });

  it('permite N1 a N2 y solo deja N1 a N3 si el área está detenida', () => {
    expect(validarEscalamiento(base).ok).toBe(true);
    expect(validarEscalamiento({ ...base, nivelDestino: 'N3' }).ok).toBe(false);
    expect(validarEscalamiento({ ...base, nivelDestino: 'N3', areaCompleta: true }).ok).toBe(true);
  });

  it('desde N2 solo permite escalar a N3', () => {
    expect(validarEscalamiento({ ...base, nivelActual: 'N2', nivelDestino: 'N3' }).ok).toBe(true);
    expect(validarEscalamiento({ ...base, nivelActual: 'N2', nivelDestino: 'N1' }).ok).toBe(false);
  });

  it('ya no permite devolver a un nivel inferior', () => {
    const resultado = validarEscalamiento({ ...base, nivelActual: 'N2', nivelDestino: 'N1', motivo: 'Era remoto' });
    expect(resultado.ok).toBe(false);
  });

  it('el agente no cierra un ticket que ya fue escalado', () => {
    expect(agentePuedeCerrar(true)).toBe(false);
    expect(agentePuedeCerrar(false)).toBe(true);
  });
});
