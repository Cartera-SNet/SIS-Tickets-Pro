import { HealthService } from './health.service';

describe('HealthService', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
  });

  it('el proceso responde ok sin consultar la base', async () => {
    const servicio = new HealthService({ ping: jest.fn() } as never);
    expect(servicio.vivo()).toEqual({ estado: 'ok' });
  });

  it('ready falla sin filtrar el error de la base', async () => {
    process.env.DATABASE_URL = 'postgresql://local/db';
    const servicio = new HealthService({
      ping: jest.fn().mockRejectedValue(new Error('password=secreto connection refused')),
    } as never);
    await expect(servicio.listo()).resolves.toEqual({
      estado: 'no_disponible',
      chequeos: { baseDatos: 'error' },
    });
  });

  it('ready queda no disponible si no hay DATABASE_URL', async () => {
    delete process.env.DATABASE_URL;
    const ping = jest.fn();
    const servicio = new HealthService({ ping } as never);
    await expect(servicio.listo()).resolves.toEqual({
      estado: 'no_disponible',
      chequeos: { baseDatos: 'error' },
    });
    expect(ping).not.toHaveBeenCalled();
  });
});
