export type BloquesActa = {
  identificacion: { numero: string; version: number; referencia: string; ticketId?: string };
  personas: { solicitante: string; sede: string; ubicacion: string; tecnico?: string };
  equipo: { placa: string | null; serial: string | null; nombre?: string | null };
  fechas: {
    apertura: string;
    solucion: string | null;
    atencion?: string | null;
    cierre?: string | null;
  };
  trabajo: { diagnostico: string; actividades: string; repuestos: string; estadoFinal: string };
  checklist: unknown[];
  observaciones: string;
  evidencias?: string[];
  confirmacionSolicitante?: string | null;
  firmas: [];
};

export function armarBloques(entrada: {
  numero: string;
  version: number;
  referencia: string;
  ticketId?: string;
  solicitante: string;
  tecnico?: string;
  sede: string;
  ubicacion: string;
  placa: string | null;
  serial: string | null;
  nombreEquipo?: string | null;
  apertura: Date;
  atencion?: Date | null;
  solucion: Date | null;
  cierre?: Date | null;
  diagnostico: string;
  actividades: string;
  repuestos: string;
  estadoFinal: string;
  checklist: unknown[];
  observaciones: string;
  evidencias?: string[];
  confirmacionSolicitante?: string | null;
}): BloquesActa {
  return {
    identificacion: {
      numero: entrada.numero,
      version: entrada.version,
      referencia: entrada.referencia,
      ticketId: entrada.ticketId,
    },
    personas: {
      solicitante: entrada.solicitante,
      sede: entrada.sede,
      ubicacion: entrada.ubicacion,
      tecnico: entrada.tecnico,
    },
    equipo: {
      placa: entrada.placa,
      serial: entrada.serial,
      nombre: entrada.nombreEquipo ?? null,
    },
    fechas: {
      apertura: entrada.apertura.toISOString(),
      atencion: entrada.atencion?.toISOString() ?? null,
      solucion: entrada.solucion?.toISOString() ?? null,
      cierre: entrada.cierre?.toISOString() ?? null,
    },
    trabajo: {
      diagnostico: entrada.diagnostico.trim(),
      actividades: entrada.actividades.trim(),
      repuestos: entrada.repuestos.trim(),
      estadoFinal: entrada.estadoFinal.trim(),
    },
    checklist: entrada.checklist,
    observaciones: entrada.observaciones.trim(),
    evidencias: entrada.evidencias ?? [],
    confirmacionSolicitante: entrada.confirmacionSolicitante ?? null,
    firmas: [],
  };
}
