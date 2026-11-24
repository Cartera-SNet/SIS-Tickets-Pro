import { redactarSecretos } from './redactar-url';

describe('redactarSecretos', () => {
  it('oculta la contraseña que Esculapio recibe en la URL', () => {
    const sucia =
      'https://apps.example/api/obtener-empresas?Usuario=ana&PasswordUsu=clave-real&BdConexion=bd';
    const limpia = redactarSecretos(sucia);
    expect(limpia).not.toContain('clave-real');
    expect(limpia).toContain('PasswordUsu=***');
    expect(limpia).toContain('Usuario=ana');
  });

  it('oculta la contraseña aunque el texto no sea una URL', () => {
    expect(redactarSecretos('fallo PasswordUsu=clave-real')).toBe('fallo PasswordUsu=***');
  });
});
