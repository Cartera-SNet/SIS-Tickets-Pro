export type ItemNav = {
  ruta: string;
  etiqueta: string;
  nota: string;
};

export const NAV: ItemNav[] = [
  { ruta: '/', etiqueta: 'Inicio', nota: 'Base del sprint 1' },
  { ruta: '/tickets', etiqueta: 'Tickets', nota: 'La bandeja llega en el sprint 4.' },
  { ruta: '/tickets/nuevo', etiqueta: 'Nuevo ticket', nota: 'Formulario web del caso.' },
  { ruta: '/agente', etiqueta: 'Agente IA (N1)', nota: 'El agente llega en los sprints 6 y 7.' },
  { ruta: '/preventivo', etiqueta: 'Mant. preventivo', nota: 'El preventivo llega en los sprints 11 y 12.' },
  { ruta: '/actas', etiqueta: 'Actas de cierre', nota: 'Las actas llegan en los sprints 10 y 11.' },
  { ruta: '/notificaciones', etiqueta: 'Notificaciones', nota: 'El centro de notificaciones llega en el sprint 8.' },
  { ruta: '/conocimiento', etiqueta: 'Base de conocimiento', nota: 'Los artículos llegan en el sprint 5.' },
  { ruta: '/reportes', etiqueta: 'Reportes', nota: 'Los reportes llegan en el sprint 8.' },
  { ruta: '/configuracion', etiqueta: 'Configuración', nota: 'La administración llega a partir del sprint 2.' },
  { ruta: '/manual', etiqueta: 'Manual', nota: 'Qué hace cada pantalla y cómo usarla.' },
];

export function itemPorRuta(ruta: string): ItemNav | undefined {
  return NAV.find((item) => item.ruta === ruta);
}

const PERMISOS_DE_RUTA: Record<string, readonly string[] | null> = {
  '/': null,
  '/tickets': ['tickets.ver_propios', 'tickets.ver_sede'],
  '/tickets/nuevo': ['tickets.crear'],
  '/agente': ['tickets.ver_sede'],
  '/preventivo': ['preventivo.ejecutar', 'reportes.ver'],
  '/actas': ['tickets.ver_sede', 'reportes.ver'],
  '/notificaciones': null,
  '/conocimiento': ['kb.aprobar', 'tickets.ver_sede'],
  '/reportes': ['reportes.ver'],
  '/configuracion': ['configuracion.editar', 'catalogos.editar', 'usuarios.administrar'],
  '/manual': null,
};

export function rutaPermitida(ruta: string, permisos: readonly string[]): boolean {
  const clave = Object.keys(PERMISOS_DE_RUTA)
    .sort((a, b) => b.length - a.length)
    .find((item) => ruta === item || (item !== '/' && ruta.startsWith(`${item}/`)));
  const requeridos = clave ? PERMISOS_DE_RUTA[clave] : null;
  if (!requeridos) {
    return true;
  }
  return requeridos.some((permiso) => permisos.includes(permiso));
}

export function menuVisible(permisos: readonly string[]): ItemNav[] {
  return NAV.filter((item) => rutaPermitida(item.ruta, permisos));
}
