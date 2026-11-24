import { createHash, randomBytes, randomInt } from 'node:crypto';

export function tokenOpaco(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

export function codigoSeis(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function crearPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function leerCookie(encabezado: string | undefined, nombre: string): string | null {
  if (!encabezado) {
    return null;
  }
  for (const parte of encabezado.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) {
      return decodeURIComponent(resto.join('='));
    }
  }
  return null;
}
