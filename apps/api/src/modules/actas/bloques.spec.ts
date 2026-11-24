import { armarBloques } from './bloques';

describe('bloques del acta', () => {
  it('arma los ocho bloques sin pdf ni hash', () => {
    const bloques = armarBloques({
      numero: 'AC-0001',
      version: 1,
      referencia: 'MA-0004',
      solicitante: 'Ana Gómez',
      sede: 'Sede Norte',
      ubicacion: 'Puesto 12',
      placa: 'PC-1001',
      serial: 'SN-1',
      apertura: new Date('2026-11-24T12:00:00Z'),
      solucion: null,
      diagnostico: 'Sin enlace',
      actividades: 'Se cambió el cable',
      repuestos: 'Cable',
      estadoFinal: 'Operativo',
      checklist: [],
      observaciones: '',
    });
    expect(Object.keys(bloques)).toEqual([
      'identificacion',
      'personas',
      'equipo',
      'fechas',
      'trabajo',
      'checklist',
      'observaciones',
      'firmas',
    ]);
    expect(bloques.firmas).toEqual([]);
    expect(JSON.stringify(bloques)).not.toContain('sha256');
  });
});
