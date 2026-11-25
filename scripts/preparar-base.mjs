// Neon entrega una URL con pooler y channel_binding. Prisma migra y consulta
// mejor por la conexión directa y con sslmode, sin channel_binding.
export function urlsDeBase(databaseUrl) {
  const runtime = new URL(databaseUrl);
  runtime.searchParams.delete('channel_binding');
  // La red interna de Railway (*.railway.internal) y el equipo local no usan TLS con certificado público.
  const esLocal =
    runtime.hostname === 'localhost' || runtime.hostname === '127.0.0.1' || runtime.hostname.endsWith('.internal');
  if (!esLocal && !runtime.searchParams.get('sslmode')) {
    runtime.searchParams.set('sslmode', 'require');
  }
  const directa = new URL(runtime.toString());
  directa.hostname = directa.hostname.replace('-pooler', '');
  directa.searchParams.delete('pgbouncer');
  directa.searchParams.delete('connection_limit');
  if (runtime.hostname.includes('-pooler')) {
    runtime.searchParams.set('pgbouncer', 'true');
    runtime.searchParams.set('connection_limit', '1');
  }
  return { runtime: runtime.toString(), directa: directa.toString() };
}
