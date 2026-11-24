import { clasificarConfianza, decidirTurno, textoSinSecretos } from './agente-turno';

describe('turno del agente', () => {
  const base = {
    esImagen: false,
    confianza: 0.9,
    umbral: 0.7,
    intentosGuia: 0,
    maxIntentos: 2,
    hayArticulo: true,
    yaEscalado: false,
  };

  it('no manda datos clínicos ni contraseñas al modelo', () => {
    expect(decidirTurno({ ...base, texto: 'el paciente Juan tiene diagnóstico X' }).tipo).toBe('privacidad');
    expect(decidirTurno({ ...base, texto: 'foto', esImagen: true }).tipo).toBe('privacidad');
    expect(decidirTurno({ ...base, texto: 'mi contraseña es secreta123' }).tipo).toBe('credencial');
    expect(textoSinSecretos('mi contraseña es secreta123')).not.toContain('secreta123');
  });

  it('descarta un pedido de software y consulta solo con la frase de estado', () => {
    expect(decidirTurno({ ...base, texto: 'necesitamos un reporte nuevo en Esculapio' }).tipo).toBe('software');
    expect(decidirTurno({ ...base, texto: 'cómo va mi ticket' }).tipo).toBe('consultar_estado');
  });

  it('guía como máximo dos veces y luego crea el ticket', () => {
    expect(decidirTurno({ ...base, texto: 'el monitor queda negro', intentosGuia: 0 }).tipo).toBe('guiar');
    expect(decidirTurno({ ...base, texto: 'el monitor queda negro', intentosGuia: 1 }).tipo).toBe('guiar');
    expect(decidirTurno({ ...base, texto: 'el monitor queda negro', intentosGuia: 2 }).tipo).toBe('crear_ticket');
  });

  it('con poca confianza pasa a un analista y no cierra un caso escalado', () => {
    expect(decidirTurno({ ...base, texto: 'algo raro', confianza: clasificarConfianza('algo raro') }).tipo).toBe('baja_confianza');
    expect(decidirTurno({ ...base, texto: 'ya quedó', intentosGuia: 1, yaEscalado: true }).tipo).not.toBe('resuelto_n1');
  });
});
