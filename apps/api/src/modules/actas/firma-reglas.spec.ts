import { createHash } from 'node:crypto';
import { codigoVerificacion, enlaceSirve, evaluarCodigo, hashDocumento, horasRestantes, plazoFirmaVencido, recordatoriosDebidos } from './firma-reglas';
import { hashToken } from '../auth/cripto';

describe('reglas de firma', () => {
  const ahora = new Date('2026-11-24T18:00:00Z');

  it('arma un código de verificación con el formato pedido', () => {
    expect(codigoVerificacion()).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('el hash cambia si cambia una firma', () => {
    const base = [{ rol: 'TECNICO', metodo: 'SESION_WEB', resultado: 'FIRMO', fecha: ahora.toISOString() }];
    const uno = hashDocumento({ numero: 'AC-0001' }, base);
    const dos = hashDocumento({ numero: 'AC-0001' }, [
      ...base,
      { rol: 'SOLICITANTE', metodo: 'DISPOSITIVO_TECNICO', resultado: 'FIRMO', fecha: ahora.toISOString() },
    ]);
    expect(uno).toHaveLength(64);
    expect(uno).not.toBe(dos);
  });

  it('rechaza un código vencido, agotado o distinto', () => {
    const hash = hashToken('123456');
    expect(
      evaluarCodigo({ hashGuardado: hash, hashRecibido: hash, expira: new Date(ahora.getTime() - 1000), intentos: 0, ahora }),
    ).toBe('vencido');
    expect(
      evaluarCodigo({ hashGuardado: hash, hashRecibido: hash, expira: new Date(ahora.getTime() + 1000), intentos: 5, ahora }),
    ).toBe('agotado');
    expect(
      evaluarCodigo({
        hashGuardado: hash,
        hashRecibido: hashToken('000000'),
        expira: new Date(ahora.getTime() + 1000),
        intentos: 0,
        ahora,
      }),
    ).toBe('incorrecto');
  });

  it('el enlace de un solo uso no sirve si ya se usó o venció', () => {
    expect(enlaceSirve(new Date(ahora.getTime() + 1000), false, ahora)).toBe(true);
    expect(enlaceSirve(new Date(ahora.getTime() + 1000), true, ahora)).toBe(false);
    expect(enlaceSirve(new Date(ahora.getTime() - 1000), false, ahora)).toBe(false);
  });

  it('avisa a las 4 h y a las 24 h, una sola vez', () => {
    const firmado = new Date(ahora.getTime() - 5 * 3_600_000);
    expect(recordatoriosDebidos(firmado, ahora, { h4: false, h24: false })).toEqual(['4h']);
    expect(recordatoriosDebidos(firmado, ahora, { h4: true, h24: false })).toEqual([]);
    const ayer = new Date(ahora.getTime() - 25 * 3_600_000);
    expect(recordatoriosDebidos(ayer, ahora, { h4: false, h24: false })).toEqual(['4h', '24h']);
  });

  it('a las 48 horas el plazo de firma está vencido', () => {
    const desde = new Date(ahora.getTime() - 48 * 3_600_000);
    expect(plazoFirmaVencido(desde, ahora, 48)).toBe(true);
    expect(horasRestantes(new Date(ahora.getTime() - 10 * 3_600_000), ahora, 48)).toBe(38);
  });

  it('no guarda el código en claro dentro del hash del documento', () => {
    const documento = hashDocumento({ numero: 'AC-0001' }, []);
    expect(documento).not.toContain('123456');
    expect(createHash('sha256').update('123456').digest('hex')).not.toBe(documento);
  });
});
