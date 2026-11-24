import { avisosProduccion, leerEntorno } from './entorno';

describe('leerEntorno', () => {
  it('usa mock y dev cuando no hay variables', () => {
    const entorno = leerEntorno({});
    expect(entorno.whatsappMode).toBe('mock');
    expect(entorno.authMode).toBe('dev');
    expect(entorno.databaseUrl).toBeNull();
  });

  it('rechaza un modo desconocido', () => {
    expect(() => leerEntorno({ ESCULAPIO_MODE: 'apagado' })).toThrow(/ESCULAPIO_MODE/);
  });

  it('exige SECRET_KEY en producción', () => {
    expect(() => leerEntorno({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://local/db' })).toThrow(
      /SECRET_KEY/,
    );
  });

  it('avisa de los modos de demostración solo en producción', () => {
    const base = { DATABASE_URL: 'postgresql://local/db', SECRET_KEY: 'clave' };
    expect(avisosProduccion(leerEntorno({ ...base, NODE_ENV: 'production' }))).toHaveLength(3);
    expect(avisosProduccion(leerEntorno({}))).toEqual([]);
    const real = leerEntorno({
      ...base,
      NODE_ENV: 'production',
      AUTH_MODE: 'oidc',
      ESCULAPIO_MODE: 'real',
      GOOGLE_AUTH_MODE: 'real',
    });
    expect(avisosProduccion(real)).toEqual([]);
  });
});
