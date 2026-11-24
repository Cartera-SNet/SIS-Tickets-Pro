export const VALORES_CANAL = ['si', 'no', 'opcional'] as const;
export type ValorCanal = (typeof VALORES_CANAL)[number];

export type FilaMatriz = {
  evento: string;
  web: ValorCanal;
  whatsapp: ValorCanal;
  correo: ValorCanal;
};

export const MATRIZ_DEFECTO: FilaMatriz[] = [
  { evento: 'ticket_creado', web: 'si', whatsapp: 'si', correo: 'opcional' },
  { evento: 'ticket_asignado', web: 'si', whatsapp: 'si', correo: 'no' },
  { evento: 'cambio_nivel', web: 'si', whatsapp: 'si', correo: 'no' },
  { evento: 'informacion_usuario', web: 'si', whatsapp: 'si', correo: 'si' },
  { evento: 'nuevo_mensaje', web: 'si', whatsapp: 'si', correo: 'no' },
  { evento: 'por_vencer', web: 'si', whatsapp: 'si', correo: 'si' },
  { evento: 'ticket_resuelto', web: 'si', whatsapp: 'si', correo: 'si' },
  { evento: 'descartado', web: 'si', whatsapp: 'si', correo: 'no' },
  { evento: 'acta_pendiente', web: 'si', whatsapp: 'si', correo: 'si' },
  { evento: 'codigo_firma', web: 'no', whatsapp: 'si', correo: 'no' },
  { evento: 'recordatorio_firma', web: 'si', whatsapp: 'si', correo: 'no' },
  { evento: 'acta_cerrada', web: 'si', whatsapp: 'si', correo: 'si' },
  { evento: 'preventivo_proximo', web: 'si', whatsapp: 'si', correo: 'opcional' },
  { evento: 'orden_vencida', web: 'si', whatsapp: 'no', correo: 'si' },
  { evento: 'whatsapp_fallo', web: 'si', whatsapp: 'no', correo: 'si' },
];

export type Destino = { web: boolean; whatsapp: boolean; correo: boolean };

export function canalesPara(
  fila: FilaMatriz,
  persona: { celularVerificado: boolean; correo: string | null; conectado: boolean },
): Destino {
  let web = fila.web === 'si';
  let whatsapp = fila.whatsapp === 'si';
  let correo = fila.correo === 'si';
  if (fila.evento === 'nuevo_mensaje' && persona.conectado) {
    whatsapp = false;
  }
  if (whatsapp && !persona.celularVerificado) {
    whatsapp = false;
    web = true;
    if (persona.correo) {
      correo = true;
    }
  }
  if (correo && !persona.correo) {
    correo = false;
  }
  return { web, whatsapp, correo };
}

export function matrizValida(filas: unknown): filas is FilaMatriz[] {
  if (!Array.isArray(filas) || filas.length !== MATRIZ_DEFECTO.length) {
    return false;
  }
  const eventos = new Set(MATRIZ_DEFECTO.map((fila) => fila.evento));
  const vistos = new Set<string>();
  for (const fila of filas) {
    if (!fila || typeof fila !== 'object') {
      return false;
    }
    const actual = fila as FilaMatriz;
    if (!eventos.has(actual.evento) || vistos.has(actual.evento)) {
      return false;
    }
    vistos.add(actual.evento);
    if (![actual.web, actual.whatsapp, actual.correo].every((valor) => VALORES_CANAL.includes(valor))) {
      return false;
    }
  }
  return vistos.size === eventos.size;
}
