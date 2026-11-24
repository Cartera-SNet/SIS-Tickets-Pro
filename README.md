# SIS · Mesa de Ayuda TI

Base del sprint 1: monorepo, modelo de PostgreSQL, API NestJS y la web en tema oscuro. El ingreso y los tickets llegan en los sprints siguientes.

No usa Docker. PostgreSQL 16 se instala en el equipo.

## Requisitos

- Node.js 22 o superior
- PostgreSQL 16
- npm 11

## Arranque local

```bash
npm install
copy .env.example .env
```

Crea la base `sis_tickets` y un usuario que coincida con `DATABASE_URL`. Luego:

```bash
npm run migrate
npm run seed
npm run dev:api
npm run dev:web
```

- API: http://localhost:3000/health
- Web: http://localhost:5173

`GET /health` dice si el proceso está vivo. `GET /health/ready` dice si PostgreSQL responde, sin mostrar el error interno.

Si la base no está levantada, la API igual arranca y la web marca la base como no disponible.

Los datos del seed son ficticios (`@example.com`). No cargues pacientes.

## Variables

Están en `.env.example`. Los adaptadores de Esculapio, WhatsApp, Google y el modelo de IA arrancan en `mock`. El modo `real` no se usa hasta tener credenciales, y no se desactiva la verificación TLS.

`SECRET_KEY` es obligatorio solo cuando `NODE_ENV=production`.

## Calidad

```bash
npm run lint
npm test
npm run build
```

## Staging

El workflow `.github/workflows/ci.yml` corre lint, tests, build y `prisma migrate deploy`. Publica en staging solo en `main` y solo si el repositorio tiene `STAGING_HOST`. El diseño del proxy está en `docs/despliegue-proxy.md`.

No desplegar en Windows Server 2012 R2.

## Railway

El repositorio trae un `Dockerfile` listo para Railway: un servicio con la API y la web, más PostgreSQL. Pasos y variables en `docs/railway.md`.

## Pendientes

`docs/PENDIENTES.md`.
