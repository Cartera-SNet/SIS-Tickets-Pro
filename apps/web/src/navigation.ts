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
];

export function itemPorRuta(ruta: string): ItemNav | undefined {
  return NAV.find((item) => item.ruta === ruta);
}
