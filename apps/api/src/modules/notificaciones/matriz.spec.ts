import { MATRIZ_DEFECTO, canalesPara, matrizValida } from './matriz';

describe('matriz de avisos', () => {
  it('trae los quince eventos de la sección 9', () => {
    expect(MATRIZ_DEFECTO).toHaveLength(15);
    expect(MATRIZ_DEFECTO.map((fila) => fila.evento)).toContain('whatsapp_fallo');
  });

  it('pasa a correo y web cuando no hay celular verificado', () => {
    const fila = MATRIZ_DEFECTO.find((item) => item.evento === 'ticket_creado')!;
    expect(
      canalesPara(fila, { celularVerificado: false, correo: 'ana@example.com', conectado: false }),
    ).toEqual({ web: true, whatsapp: false, correo: true });
  });

  it('no reenvía por WhatsApp un mensaje si la persona está conectada', () => {
    const fila = MATRIZ_DEFECTO.find((item) => item.evento === 'nuevo_mensaje')!;
    expect(canalesPara(fila, { celularVerificado: true, correo: null, conectado: true }).whatsapp).toBe(false);
  });

  it('rechaza una matriz incompleta', () => {
    expect(matrizValida(MATRIZ_DEFECTO)).toBe(true);
    expect(matrizValida(MATRIZ_DEFECTO.slice(0, 14))).toBe(false);
  });
});
