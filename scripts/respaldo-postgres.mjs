import { execFile } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);
const binario = process.env.PG_DUMP ?? 'C:\\Users\\JUSSEF OGAZA\\pgsql16\\pgsql\\bin\\pg_dump.exe';
const url = (process.env.DATABASE_URL ?? '').replace(/\?.*$/, '');
const destino = join(process.cwd(), 'backups');
const archivo = join(destino, `sis_tickets-${new Date().toISOString().slice(0, 10)}.dump`);

await mkdir(destino, { recursive: true });
await ejecutar(binario, ['--format=custom', '--file', archivo, '--dbname', url], {
  env: process.env,
});
const info = await stat(archivo);
if (info.size < 100) {
  throw new Error('El respaldo quedó vacío.');
}
console.log(JSON.stringify({ archivo, bytes: info.size }));
