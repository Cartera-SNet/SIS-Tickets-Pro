const host = process.env.STAGING_HOST ?? '';
const user = process.env.STAGING_USER ?? '';
const path = process.env.STAGING_PATH ?? '';

if (!host || !user || !path) {
  console.error('Faltan STAGING_HOST, STAGING_USER o STAGING_PATH. No se publicó.');
  process.exit(1);
}

console.log(`Listo para publicar el build en ${user}@${host}:${path}.`);
console.log('La copia al servidor sigue el diseño de docs/despliegue-proxy.md.');
console.log('Este paso no abre el webhook a internet ni usa Windows Server 2012 R2.');
