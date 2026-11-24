import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);
const binario = process.env.PG_RESTORE ?? 'C:\\Users\\JUSSEF OGAZA\\pgsql16\\pgsql\\bin\\pg_restore.exe';
const archivo = process.argv[2];
if (!archivo) {
  throw new Error('Indica el archivo .dump');
}
const { stdout } = await ejecutar(binario, ['--list', archivo]);
const tablas = stdout.split('\n').filter((linea) => linea.includes('TABLE DATA')).length;
if (tablas < 1) {
  throw new Error('El respaldo no lista tablas.');
}
console.log(JSON.stringify({ archivo, tablas, restaurable: true }));
