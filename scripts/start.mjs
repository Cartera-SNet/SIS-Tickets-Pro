// Arranque para producción (Railway u otro host con contenedor).
// 1) valida variables, 2) aplica migraciones, 3) carga los datos base solo si la base está vacía,
// 4) levanta la API, que también entrega la web compilada.
import { spawnSync } from 'node:child_process';
import { setTimeout as esperar } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';

const faltan = ['DATABASE_URL', 'SECRET_KEY'].filter((nombre) => !process.env[nombre]?.trim());
if (faltan.length > 0) {
  console.error(`Faltan variables obligatorias: ${faltan.join(', ')}. Defínelas en el servicio y vuelve a desplegar.`);
  process.exit(1);
}

function ejecutar(comando, argumentos) {
  return spawnSync(comando, argumentos, { stdio: 'inherit', env: process.env }).status === 0;
}

// La base puede tardar unos segundos en aceptar conexiones justo después de crearse.
const INTENTOS = 6;
let migrado = false;
for (let intento = 1; intento <= INTENTOS && !migrado; intento += 1) {
  console.log(`Aplicando migraciones (intento ${intento} de ${INTENTOS})...`);
  migrado = ejecutar('npm', ['run', 'migrate']);
  if (!migrado && intento < INTENTOS) {
    await esperar(5000);
  }
}
if (!migrado) {
  console.error('No se pudieron aplicar las migraciones. Revisa DATABASE_URL y que PostgreSQL esté activo.');
  process.exit(1);
}

if (process.env.SKIP_SEED !== 'true') {
  const prisma = new PrismaClient();
  let usuarios = 0;
  try {
    usuarios = await prisma.usuario.count();
  } finally {
    await prisma.$disconnect();
  }
  if (usuarios === 0) {
    console.log('Base vacía: cargando datos base y usuarios de demostración (@example.com).');
    if (!ejecutar('npm', ['run', 'seed', '-w', '@sis/api'])) {
      console.error('Falló la carga de datos base.');
      process.exit(1);
    }
  }
}

await import('../apps/api/dist/main.js');
