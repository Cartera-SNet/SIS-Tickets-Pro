import { salaSede, salaTicket, salaUsuario } from './salas';

describe('salas de tiempo real', () => {
  it('separa por usuario, sede y ticket, sin un canal global', () => {
    expect(salaUsuario('ana')).toBe('usuario:ana');
    expect(salaTicket('t1')).toBe('ticket:t1');
    expect(salaSede('norte')).toBe('sede:norte');
    expect([salaUsuario('ana'), salaTicket('t1')].join(' ')).not.toContain('*');
  });
});
