import { ConfiguracionService } from './configuracion.service';
import type { ConfiguracionRepository } from './configuracion.repository';

function servicioCon(fila: { clave: string; valor: string; tipo: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' } | null) {
  const repositorio = {
    buscarPorClave: async () => fila,
  } as unknown as ConfiguracionRepository;
  return new ConfiguracionService(repositorio);
}

describe('ConfiguracionService', () => {
  it('devuelve el valor por defecto si la clave no existe', async () => {
    await expect(servicioCon(null).booleano('agente_ia_en_web', false)).resolves.toBe(false);
  });

  it('lee un booleano guardado', async () => {
    const servicio = servicioCon({ clave: 'gmail_requiere_aprobacion', valor: 'true', tipo: 'BOOLEAN' });
    await expect(servicio.booleano('gmail_requiere_aprobacion', false)).resolves.toBe(true);
  });

  it('rechaza un número mal guardado', async () => {
    const servicio = servicioCon({ clave: 'plazo_cierre_sin_firma_horas', valor: 'dos', tipo: 'NUMBER' });
    await expect(servicio.numero('plazo_cierre_sin_firma_horas', 48)).rejects.toThrow(/no es numérica/);
  });
});
