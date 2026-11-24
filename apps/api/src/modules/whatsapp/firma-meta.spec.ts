import { createHmac } from 'node:crypto';
import { esHerramientaCerrada, firmaMetaValida, soloPlantilla } from './firma-meta';

describe('WhatsApp', () => {
  it('acepta la firma de Meta y rechaza una alterada', () => {
    const cuerpo = Buffer.from('{"hola":1}');
    const secreto = 'dev-webhook-secret';
    const firma = 'sha256=' + createHmac('sha256', secreto).update(cuerpo).digest('hex');
    expect(firmaMetaValida(cuerpo, firma, secreto)).toBe(true);
    expect(firmaMetaValida(cuerpo, firma, 'otra')).toBe(false);
    expect(firmaMetaValida(cuerpo, undefined, secreto)).toBe(false);
    expect(firmaMetaValida(cuerpo, firma, '')).toBe(false);
  });

  it('fuera de 24 horas solo permite plantilla', () => {
    const ahora = new Date('2026-11-24T18:00:00Z');
    expect(soloPlantilla(null, ahora)).toBe(true);
    expect(soloPlantilla(new Date('2026-11-24T10:00:00Z'), ahora)).toBe(false);
    expect(soloPlantilla(new Date('2026-11-23T10:00:00Z'), ahora)).toBe(true);
  });

  it('el agente solo puede llamar su conjunto cerrado', () => {
    expect(esHerramientaCerrada('buscar_articulo_kb')).toBe(true);
    expect(esHerramientaCerrada('borrar_base')).toBe(false);
  });
});
