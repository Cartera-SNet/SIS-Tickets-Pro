export const MAX_INTENTOS = 5;
export const VENTANA_MS = 10 * 60 * 1000;
export const BLOQUEO_MS = 15 * 60 * 1000;

export type EstadoIntentos = {
  intentos: number;
  primerIntento: number;
  bloqueadoHasta: number | null;
};

export function evaluarIntento(
  estado: EstadoIntentos | null,
  ahora: number,
): { permitido: boolean } {
  if (estado?.bloqueadoHasta && estado.bloqueadoHasta > ahora) {
    return { permitido: false };
  }
  return { permitido: true };
}

export function registrarFallo(
  estado: EstadoIntentos | null,
  ahora: number,
): { siguiente: EstadoIntentos; restantes: number } {
  const ventanaNueva = !estado || ahora - estado.primerIntento > VENTANA_MS;
  const intentos = ventanaNueva ? 1 : estado.intentos + 1;
  const primerIntento = ventanaNueva ? ahora : estado.primerIntento;
  const bloqueado = intentos >= MAX_INTENTOS;
  return {
    siguiente: {
      intentos,
      primerIntento,
      bloqueadoHasta: bloqueado ? ahora + BLOQUEO_MS : null,
    },
    restantes: Math.max(0, MAX_INTENTOS - intentos),
  };
}

export function mensajeCredenciales(restantes: number): string {
  return `Credenciales inválidas. ${restantes} intento(s) restantes.`;
}

export function empresaPermitida(empresas: { cod: string }[], cod: string): boolean {
  return empresas.some((empresa) => empresa.cod === cod);
}

export type RolAcceso = 'SOLICITANTE' | 'TECNICO' | 'ADMINISTRADOR';

export type Principal = {
  id: string;
  rol: RolAcceso;
  sedeId: string | null;
  niveles: string[];
};

export function dondeTickets(principal: Principal): Record<string, unknown> {
  if (principal.rol === 'ADMINISTRADOR') {
    return { deletedAt: null };
  }
  if (principal.rol === 'TECNICO') {
    return {
      deletedAt: null,
      sedeId: principal.sedeId,
      OR: [{ responsableId: principal.id }, { nivel: { in: principal.niveles } }],
    };
  }
  return { deletedAt: null, solicitanteId: principal.id };
}

export function celularEstaPermitido(tipoPermite: boolean, areaPermite: boolean | null): boolean {
  if (areaPermite === false) {
    return false;
  }
  if (areaPermite === true) {
    return true;
  }
  return tipoPermite;
}

export function puedeUsarLaMesa(estado: string): boolean {
  return estado === 'APROBADO';
}

export function ipCliente(
  remote: string | undefined,
  forwarded: string | undefined,
  trusted: string | null,
): string {
  const origen = remote ?? 'desconocida';
  if (trusted && origen === trusted && forwarded) {
    const primera = forwarded.split(',')[0]?.trim();
    return primera || origen;
  }
  return origen;
}

export const POLITICA_REINTENTO = {
  retryLimit: 5,
  retryDelay: 30,
  retryBackoff: true,
} as const;

export function datosPreauthEsculapio(entrada: {
  usuario: string;
  servidor: string;
  empresas: { cod: string; nombre: string; sede: string }[];
}): { usuarioEsculapio: string; servidorEsculapio: string; empresas: { cod: string; nombre: string; sede: string }[] } {
  return {
    usuarioEsculapio: entrada.usuario,
    servidorEsculapio: entrada.servidor,
    empresas: entrada.empresas,
  };
}
