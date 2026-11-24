import { createHash, randomBytes } from 'node:crypto';

export const MINUTOS_CODIGO = 5;
export const HORAS_ENLACE = 48;
export const MAX_INTENTOS_CODIGO = 5;

export function codigoVerificacion(): string {
  const crudo = randomBytes(4).toString('hex').toUpperCase();
  return `${crudo.slice(0, 4)}-${crudo.slice(4)}`;
}

export function hashDocumento(contenido: unknown, firmas: { rol: string; metodo: string; resultado: string; fecha: string }[]): string {
  const canonico = JSON.stringify({ contenido, firmas });
  return createHash('sha256').update(canonico).digest('hex');
}

export type ResultadoCodigo = 'ok' | 'vencido' | 'agotado' | 'incorrecto';

export function evaluarCodigo(entrada: {
  hashGuardado: string;
  hashRecibido: string;
  expira: Date;
  intentos: number;
  ahora: Date;
}): ResultadoCodigo {
  if (entrada.intentos >= MAX_INTENTOS_CODIGO) {
    return 'agotado';
  }
  if (entrada.expira.getTime() <= entrada.ahora.getTime()) {
    return 'vencido';
  }
  if (entrada.hashGuardado !== entrada.hashRecibido) {
    return 'incorrecto';
  }
  return 'ok';
}

export function enlaceSirve(vence: Date, usado: boolean, ahora: Date): boolean {
  return !usado && vence.getTime() > ahora.getTime();
}

export function plazoFirmaVencido(desde: Date, ahora: Date, horas = 48): boolean {
  return ahora.getTime() - desde.getTime() >= horas * 3_600_000;
}

export function horasRestantes(desde: Date, ahora: Date, horas = 48): number {
  const restante = horas - (ahora.getTime() - desde.getTime()) / 3_600_000;
  return Math.max(0, Math.round(restante * 10) / 10);
}

export function recordatoriosDebidos(
  firmadoEn: Date,
  ahora: Date,
  ya: { h4: boolean; h24: boolean },
): ('4h' | '24h')[] {
  const horas = (ahora.getTime() - firmadoEn.getTime()) / 3_600_000;
  const debidos: ('4h' | '24h')[] = [];
  if (horas >= 4 && !ya.h4) {
    debidos.push('4h');
  }
  if (horas >= 24 && !ya.h24) {
    debidos.push('24h');
  }
  return debidos;
}
