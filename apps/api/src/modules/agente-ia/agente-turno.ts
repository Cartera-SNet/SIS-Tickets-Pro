export type DecisionAgente =
  | { tipo: 'privacidad' }
  | { tipo: 'credencial' }
  | { tipo: 'software' }
  | { tipo: 'baja_confianza'; confianza: number }
  | { tipo: 'consultar_estado' }
  | { tipo: 'guiar'; confianza: number }
  | { tipo: 'crear_ticket'; confianza: number }
  | { tipo: 'resuelto_n1'; confianza: number };

const CLINICO = /\b(paciente|historia clínica|historia clinica|cédula|cedula|diagnóstico|diagnostico|epicrisis)\b/i;
const CREDENCIAL = /\b(contraseña|password|clave es|código de verificación|codigo de verificacion)\b/i;
const SOFTWARE = /\b(reporte nuevo|desarrollar|modificar el sistema|calcula mal|aplicación para|aplicacion para)\b/i;
const ESTADO = /\b(estado de mi|cómo va|como va|número de mi ticket|numero de mi ticket)\b/i;
const RESUELTO = /\b(ya quedó|ya quedo|funcionó|funciono|listo gracias)\b/i;

export function clasificarConfianza(texto: string): number {
  if (/\b(monitor|teclado|mouse|internet|impresora|correo|word|excel|wifi|vpn)\b/i.test(texto)) {
    return 0.9;
  }
  return 0.4;
}

export function decidirTurno(entrada: {
  texto: string;
  esImagen: boolean;
  confianza: number;
  umbral: number;
  intentosGuia: number;
  maxIntentos: number;
  hayArticulo: boolean;
  yaEscalado: boolean;
}): DecisionAgente {
  if (entrada.esImagen || CLINICO.test(entrada.texto)) {
    return { tipo: 'privacidad' };
  }
  if (CREDENCIAL.test(entrada.texto)) {
    return { tipo: 'credencial' };
  }
  if (SOFTWARE.test(entrada.texto)) {
    return { tipo: 'software' };
  }
  if (ESTADO.test(entrada.texto)) {
    return { tipo: 'consultar_estado' };
  }
  if (entrada.confianza < entrada.umbral) {
    return { tipo: 'baja_confianza', confianza: entrada.confianza };
  }
  if (RESUELTO.test(entrada.texto) && entrada.intentosGuia > 0 && !entrada.yaEscalado) {
    return { tipo: 'resuelto_n1', confianza: entrada.confianza };
  }
  if (entrada.hayArticulo && entrada.intentosGuia < entrada.maxIntentos) {
    return { tipo: 'guiar', confianza: entrada.confianza };
  }
  return { tipo: 'crear_ticket', confianza: entrada.confianza };
}

export function textoSinSecretos(texto: string): string {
  return texto.replace(/\b(contraseña|password|clave)(\s+es)?\s+\S+/gi, '$1 ***');
}
