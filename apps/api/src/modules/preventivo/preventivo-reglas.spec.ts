import { cumplimiento, dentroDeAnticipacion, faltanObligatorios, sumarFrecuencia } from './preventivo-reglas';

describe('preventivo', () => {
  const ahora = new Date('2026-11-24T12:00:00Z');

  it('anticipa 15 días y no genera fuera de esa ventana', () => {
    const cerca = new Date('2026-12-05T12:00:00Z');
    const lejos = new Date('2027-02-01T12:00:00Z');
    expect(dentroDeAnticipacion(cerca, ahora, 15)).toBe(true);
    expect(dentroDeAnticipacion(lejos, ahora, 15)).toBe(false);
  });

  it('suma la frecuencia del plan', () => {
    expect(sumarFrecuencia(ahora, 'TRIMESTRAL').toISOString().slice(0, 10)).toBe('2027-02-22');
  });

  it('no deja generar el acta si falta un ítem obligatorio', () => {
    const items = [
      { id: 'a', texto: 'Limpiar ventilador', obligatorio: true, tipo: 'casilla' as const },
      { id: 'b', texto: 'Temperatura', obligatorio: true, tipo: 'valor' as const, unidad: '°C' },
      { id: 'c', texto: 'Foto del puesto', obligatorio: true, tipo: 'foto' as const },
    ];
    expect(faltanObligatorios(items, [{ itemId: 'a', valor: 'si' }])).toEqual(['Temperatura', 'Foto del puesto']);
    expect(
      faltanObligatorios(items, [
        { itemId: 'a', valor: 'si' },
        { itemId: 'b', valor: '42' },
        { itemId: 'c', foto: true },
      ]),
    ).toEqual([]);
  });

  it('mide el cumplimiento con las actas firmadas del periodo', () => {
    expect(cumplimiento(4, 1)).toBe(25);
    expect(cumplimiento(0, 0)).toBe(0);
  });
});
