export type BloquesActa = {
  identificacion: { numero: string; version: number; referencia: string };
  personas: { solicitante: string; sede: string; ubicacion: string };
  equipo: { placa: string | null; serial: string | null };
  fechas: { apertura: string; solucion: string | null };
  trabajo: { diagnostico: string; actividades: string; repuestos: string; estadoFinal: string };
  checklist: unknown[];
  observaciones: string;
  firmas: [];
};

export function armarBloques(entrada: {
  numero: string;
  version: number;
  referencia: string;
  solicitante: string;
  sede: string;
  ubicacion: string;
  placa: string | null;
  serial: string | null;
  apertura: Date;
  solucion: Date | null;
  diagnostico: string;
  actividades: string;
  repuestos: string;
  estadoFinal: string;
  checklist: unknown[];
  observaciones: string;
}): BloquesActa {
  return {
    identificacion: { numero: entrada.numero, version: entrada.version, referencia: entrada.referencia },
    personas: { solicitante: entrada.solicitante, sede: entrada.sede, ubicacion: entrada.ubicacion },
    equipo: { placa: entrada.placa, serial: entrada.serial },
    fechas: { apertura: entrada.apertura.toISOString(), solucion: entrada.solucion?.toISOString() ?? null },
    trabajo: {
      diagnostico: entrada.diagnostico.trim(),
      actividades: entrada.actividades.trim(),
      repuestos: entrada.repuestos.trim(),
      estadoFinal: entrada.estadoFinal.trim(),
    },
    checklist: entrada.checklist,
    observaciones: entrada.observaciones.trim(),
    firmas: [],
  };
}
