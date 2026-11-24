import {
  celularEstaPermitido,
  datosPreauthEsculapio,
  dondeTickets,
  empresaPermitida,
  evaluarIntento,
  ipCliente,
  mensajeCredenciales,
  POLITICA_REINTENTO,
  puedeUsarLaMesa,
  registrarFallo,
} from './reglas-acceso';

describe('reglas de acceso', () => {
  const ahora = 1_000_000;

  it('al quinto fallo bloquea 15 minutos y avisa los restantes', () => {
    let estado = null;
    let restantes = 5;
    for (let i = 0; i < 5; i += 1) {
      const paso = registrarFallo(estado, ahora);
      estado = paso.siguiente;
      restantes = paso.restantes;
    }
    expect(restantes).toBe(0);
    expect(mensajeCredenciales(restantes)).toBe('Credenciales inválidas. 0 intento(s) restantes.');
    expect(evaluarIntento(estado, ahora + 1000).permitido).toBe(false);
    expect(evaluarIntento(estado, ahora + 15 * 60 * 1000 + 1).permitido).toBe(true);
  });

  it('no acepta una empresa que no vino de Esculapio', () => {
    expect(empresaPermitida([{ cod: '01' }], '01')).toBe(true);
    expect(empresaPermitida([{ cod: '01' }], '99')).toBe(false);
  });

  it('el solicitante solo ve sus tickets y el técnico los de su sede', () => {
    expect(dondeTickets({ id: 'ana', rol: 'SOLICITANTE', sedeId: 'norte', niveles: [] })).toEqual({
      deletedAt: null,
      solicitanteId: 'ana',
    });
    expect(dondeTickets({ id: 'luis', rol: 'TECNICO', sedeId: 'norte', niveles: ['N1', 'N2'] })).toMatchObject({
      sedeId: 'norte',
    });
    expect(dondeTickets({ id: 'marta', rol: 'ADMINISTRADOR', sedeId: null, niveles: [] })).toEqual({
      deletedAt: null,
    });
  });

  it('un área sin celular anula el permiso del tipo de personal', () => {
    expect(celularEstaPermitido(true, false)).toBe(false);
    expect(celularEstaPermitido(false, null)).toBe(false);
    expect(celularEstaPermitido(true, null)).toBe(true);
  });

  it('Gmail pendiente no entra a la mesa', () => {
    expect(puedeUsarLaMesa('PENDIENTE')).toBe(false);
    expect(puedeUsarLaMesa('APROBADO')).toBe(true);
  });

  it('ignora X-Forwarded-For si no viene del proxy propio', () => {
    expect(ipCliente('10.0.0.8', '1.2.3.4', '10.0.0.1')).toBe('10.0.0.8');
    expect(ipCliente('10.0.0.1', '1.2.3.4, 10.0.0.1', '10.0.0.1')).toBe('1.2.3.4');
  });

  it('la preautenticación no guarda la contraseña y la cola reintenta con espera', () => {
    const datos = datosPreauthEsculapio({
      usuario: 'ana',
      servidor: 'Servidor de prueba',
      empresas: [{ cod: '01', nombre: 'Clínica Ejemplo', sede: 'Sede Norte' }],
    });
    expect(datos).not.toHaveProperty('password');
    expect(POLITICA_REINTENTO).toEqual({ retryLimit: 5, retryDelay: 30, retryBackoff: true });
  });
});
