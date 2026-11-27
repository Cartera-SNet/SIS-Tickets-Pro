export const ROLES = ["SOLICITANTE", "TECNICO", "ADMINISTRADOR"] as const;
export type Rol = (typeof ROLES)[number];

export const ETIQUETA_ROL: Record<Rol, string> = {
  SOLICITANTE: "Solicitante",
  TECNICO: "Técnico",
  ADMINISTRADOR: "Administrador",
};

export const NIVELES = ["N1", "N2", "N3"] as const;
export type NivelAtencion = (typeof NIVELES)[number];

/** Estados del correctivo. En base se guarda el código; en pantalla, la etiqueta. */
export const ESTADO_TICKET = {
  NUEVO: "Nuevo",
  EN_ATENCION_N1: "En atención N1",
  ESCALADO: "Escalado",
  ASIGNADO: "Asignado",
  EN_SITIO: "En sitio",
  EN_PROCESO: "En proceso",
  ESPERANDO_USUARIO: "Esperando usuario",
  ESPERANDO_REPUESTO: "Esperando repuesto",
  RESUELTO: "Solucionado, pendiente de confirmación",
  CERRADO: "Cerrado",
  PENDIENTE_DE_FIRMA: "Pendiente de firma",
  CERRADO_CON_ACTA: "Cerrado con acta",
  CERRADO_SIN_FIRMA: "Cerrado sin firma",
  FIRMA_RECHAZADA: "Firma rechazada",
  DESCARTADO: "Descartado",
  CANCELADO: "Cancelado",
  REABIERTO: "Reabierto",
} as const;

export const ESTADO_ORDEN = {
  PROGRAMADA: "Programada",
  ASIGNADA: "Asignada",
  EN_EJECUCION: "En ejecución",
  PENDIENTE_DE_FIRMA: "Pendiente de firma",
  CERRADA_CON_ACTA: "Cerrada con acta",
  REPROGRAMADA: "Reprogramada",
  VENCIDA: "Vencida",
} as const;

export const PERMISOS = [
  "tickets.crear",
  "tickets.ver_propios",
  "tickets.ver_sede",
  "tickets.asignar",
  "tickets.escalar",
  "tickets.resolver",
  "tickets.calificar",
  "descartes.revisar",
  "kb.aprobar",
  "actas.firmar",
  "preventivo.ejecutar",
  "reportes.ver",
  "catalogos.editar",
  "usuarios.administrar",
  "configuracion.editar",
] as const;

export type Permiso = (typeof PERMISOS)[number];

export const PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]> = {
  SOLICITANTE: ["tickets.crear", "tickets.ver_propios", "tickets.calificar", "actas.firmar"],
  TECNICO: [
    "tickets.ver_sede",
    "tickets.escalar",
    "tickets.resolver",
    "actas.firmar",
    "preventivo.ejecutar",
  ],
  ADMINISTRADOR: [...PERMISOS],
};

export function etiquetaDeEstadoTicket(codigo: keyof typeof ESTADO_TICKET): string {
  return ESTADO_TICKET[codigo];
}
