const { spawnSync } = require('node:child_process');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const comando = process.argv.slice(2);
if (comando.length === 0) {
  console.error('Falta el comando de Prisma.');
  process.exit(1);
}

const resultado = spawnSync(comando[0], comando.slice(1), {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

process.exit(resultado.status ?? 1);
