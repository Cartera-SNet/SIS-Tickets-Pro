import { prioridadPorImpacto, sumarTiempoHabil } from './ans';

describe('prioridad y ANS', () => {
  it('prioriza el área detenida como crítica y a una persona como alta', () => {
    expect(prioridadPorImpacto({ puedeTrabajar: false, personas: 20, areaCompleta: true })).toBe('CRITICA');
    expect(prioridadPorImpacto({ puedeTrabajar: false, personas: 1, areaCompleta: false })).toBe('ALTA');
    expect(prioridadPorImpacto({ puedeTrabajar: true, personas: 1, areaCompleta: false })).toBe('BAJA');
  });

  it('suma 15 minutos hábiles dentro de la jornada', () => {
    const lunes = new Date(2026, 10, 23, 9, 0, 0);
    const resultado = sumarTiempoHabil(lunes, 15, 'MINUTOS');
    expect(resultado.getHours()).toBe(9);
    expect(resultado.getMinutes()).toBe(15);
  });

  it('pasa al siguiente día hábil si el plazo se sale de la jornada', () => {
    const viernes = new Date(2026, 10, 20, 16, 30, 0);
    const resultado = sumarTiempoHabil(viernes, 60, 'MINUTOS');
    expect(resultado.getDay()).toBe(1);
    expect(resultado.getHours()).toBe(8);
    expect(resultado.getMinutes()).toBe(30);
  });
});
