const CLAVES_SECRETAS = ['PasswordUsu', 'password', 'token', 'access_token', 'client_secret', 'api_key'];

export function redactarSecretos(texto: string): string {
  return texto.replace(new RegExp(`((?:${CLAVES_SECRETAS.join('|')})=)[^&\\s]*`, 'gi'), '$1***');
}
