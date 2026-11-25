import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { menuVisible, NAV } from './navigation';

describe('navegación y tema', () => {
  it('expone el menú de la mesa en español', () => {
    expect(NAV.map((item) => item.etiqueta)).toEqual([
      'Inicio',
      'Tickets',
      'Nuevo ticket',
      'Agente IA (N1)',
      'Mant. preventivo',
      'Actas de cierre',
      'Notificaciones',
      'Base de conocimiento',
      'Reportes',
      'Configuración',
    ]);
  });

  it('al solicitante solo le deja solicitar y seguir sus casos', () => {
    const permisos = ['tickets.crear', 'tickets.ver_propios', 'tickets.calificar', 'actas.firmar'];
    expect(menuVisible(permisos).map((item) => item.etiqueta)).toEqual([
      'Inicio',
      'Tickets',
      'Nuevo ticket',
      'Notificaciones',
    ]);
  });

  it('usa la paleta del tema oscuro', () => {
    const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
    for (const token of ['#0b141c', '#0e1821', '#182633', '#14a3a3', '#19a082', '#e6eef5']) {
      expect(css).toContain(token);
    }
  });
});
