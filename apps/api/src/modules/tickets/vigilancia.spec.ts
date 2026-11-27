import { debeCerrarSinConfirmacion, debeReabrirSinConfirmacion, estaPorVencer } from './vigilancia';

describe('vigilancia de plazos', () => {
  const ahora = new Date('2026-11-24T15:00:00Z');

  it('avisa dentro de la ventana y no cuando ya cerró', () => {
    const objetivo = new Date('2026-11-24T15:10:00Z');
    expect(estaPorVencer(objetivo, ahora, 15, 'EN_ATENCION_N1')).toBe(true);
    expect(estaPorVencer(objetivo, ahora, 15, 'CERRADO')).toBe(false);
    expect(estaPorVencer(new Date('2026-11-24T16:00:00Z'), ahora, 15, 'NUEVO')).toBe(false);
  });

  it('cierra un resuelto si nadie confirma a tiempo', () => {
    const ayer = new Date('2026-11-23T15:00:00Z');
    expect(debeCerrarSinConfirmacion('RESUELTO', ayer, ahora, 24)).toBe(true);
    expect(debeCerrarSinConfirmacion('RESUELTO', new Date('2026-11-24T14:00:00Z'), ahora, 24)).toBe(false);
    expect(debeReabrirSinConfirmacion('RESUELTO', false, ayer, ahora, 24)).toBe(true);
  });
});
