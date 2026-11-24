import { join } from 'node:path';

/**
 * Valores por defecto cuando el proceso corre en Railway. Debe importarse antes que
 * cualquier otro módulo de la API: varios módulos leen process.env al cargarse.
 * Nunca pisa una variable que la persona ya definió.
 */
function definir(nombre: string, valor: string | null): void {
  if (valor && !process.env[nombre]?.trim()) {
    process.env[nombre] = valor;
  }
}

const dominioPublico = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
definir('WEB_ORIGIN', dominioPublico ? `https://${dominioPublico}` : null);

const volumen = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
definir('UPLOAD_DIR', volumen ? join(volumen, 'uploads') : null);
definir('STORAGE_DIR', volumen ? join(volumen, 'storage') : null);
