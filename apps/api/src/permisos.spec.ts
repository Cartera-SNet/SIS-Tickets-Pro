import { PERMISOS_POR_ROL, ROLES } from '@sis/shared';

describe('permisos iniciales', () => {
  it('solo hay tres roles y el solicitante no administra catálogos', () => {
    expect(ROLES).toEqual(['SOLICITANTE', 'TECNICO', 'ADMINISTRADOR']);
    expect(PERMISOS_POR_ROL.SOLICITANTE).not.toContain('catalogos.editar');
    expect(PERMISOS_POR_ROL.TECNICO).toContain('tickets.escalar');
    expect(PERMISOS_POR_ROL.ADMINISTRADOR).toContain('kb.aprobar');
  });
});
