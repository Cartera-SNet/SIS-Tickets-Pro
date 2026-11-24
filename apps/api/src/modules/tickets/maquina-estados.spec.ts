import { puedeTransicionar } from './maquina-estados';

const remoto = { estuvoEnSitio: false, actaFirmada: false, plazoFirmaVencido: false };

describe('máquina de estados', () => {
  it('no deja resolver sin solución', () => {
    const resultado = puedeTransicionar('EN_ATENCION_N1', 'RESUELTO', { ...remoto, solucionAplicada: '  ' });
    expect(resultado.ok).toBe(false);
  });

  it('resuelve en N1 cuando hay solución', () => {
    const resultado = puedeTransicionar('EN_ATENCION_N1', 'RESUELTO', {
      ...remoto,
      solucionAplicada: 'Se reinstaló el navegador.',
    });
    expect(resultado.ok).toBe(true);
  });

  it('un caso en sitio no se cierra sin acta', () => {
    const resultado = puedeTransicionar('RESUELTO', 'CERRADO', {
      ...remoto,
      estuvoEnSitio: true,
      solucionAplicada: 'Cambio de cable.',
    });
    expect(resultado.ok).toBe(false);
  });

  it('la firma rechazada devuelve el caso al sitio', () => {
    expect(puedeTransicionar('FIRMA_RECHAZADA', 'EN_SITIO', remoto).ok).toBe(true);
    expect(puedeTransicionar('FIRMA_RECHAZADA', 'CERRADO', remoto).ok).toBe(false);
  });

  it('cerrar sin firma exige el plazo vencido', () => {
    expect(
      puedeTransicionar('PENDIENTE_DE_FIRMA', 'CERRADO_SIN_FIRMA', { ...remoto, estuvoEnSitio: true }).ok,
    ).toBe(false);
    expect(
      puedeTransicionar('PENDIENTE_DE_FIRMA', 'CERRADO_SIN_FIRMA', {
        ...remoto,
        estuvoEnSitio: true,
        plazoFirmaVencido: true,
      }).ok,
    ).toBe(true);
  });
});
