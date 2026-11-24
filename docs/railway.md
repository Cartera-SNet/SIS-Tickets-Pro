# Despliegue en Railway

Un solo servicio (la API NestJS, que también entrega la web compilada) más una base PostgreSQL. Todo queda en el mismo dominio, así que no hay CORS ni problemas de cookies.

El repositorio trae un `Dockerfile` en la raíz. Railway lo detecta solo y lo usa. No hay `railway.json`: Railway lo marcó como obsoleto y los servicios nuevos ya no pueden usarlo.

## Pasos

1. **Sube el repositorio a GitHub** (rama `main`).
2. En Railway: **New Project → Deploy from GitHub repo** y elige el repositorio.
3. En el mismo proyecto: **+ New → Database → Add PostgreSQL**.
4. En el servicio de la app, pestaña **Variables**, agrega solo estas dos:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (usa el nombre real de tu servicio de base si no es `Postgres`) |
   | `SECRET_KEY` | un texto largo y aleatorio. Para generarlo: `openssl rand -hex 32` |

5. **Volumen** (para adjuntos de tickets y actas en PDF): en el servicio, **Settings → Volumes → Add Volume**, ruta de montaje `/data`. La app lo detecta sola (`RAILWAY_VOLUME_MOUNT_PATH`). Sin volumen todo funciona, pero los archivos se pierden en cada despliegue.
6. **Settings → Networking → Generate Domain**. La app toma ese dominio sola para `WEB_ORIGIN` (enlaces de firma y verificación de actas). Si generas el dominio después del primer despliegue, haz **Redeploy** para que la app lo tome.
7. Opcional: **Settings → Deploy → Healthcheck Path** = `/health`.

Con eso el despliegue arranca. No hace falta ejecutar nada a mano.

## Qué pasa al arrancar

`scripts/start.mjs` hace, en orden:

1. Verifica que existan `DATABASE_URL` y `SECRET_KEY`. Si falta alguna, se detiene y lo dice en el log.
2. Aplica las migraciones (`prisma migrate deploy`). Reintenta hasta 6 veces por si la base tarda en aceptar conexiones.
3. Si la base no tiene ningún usuario, carga los datos base y los usuarios de demostración. En los despliegues siguientes **no** vuelve a cargar nada (el seed pisaría prioridades y catálogos editados). `SKIP_SEED=true` desactiva este paso.
4. Levanta la API.

## Entrar en modo demostración

Con las variables por defecto los adaptadores están en `mock` y `AUTH_MODE=dev`. La pantalla de ingreso lista los usuarios de prueba y se entra con un clic:

| Usuario | Rol |
|---|---|
| Ana Gómez | Solicitante |
| Luis Pérez | Técnico |
| Marta Ruiz | Administradora |

> **Seguridad.** `AUTH_MODE=dev` permite entrar como cualquier usuario **sin contraseña**. Con una URL pública, cualquiera que la conozca entra como administrador. Úsalo solo con datos ficticios. La API lo recuerda en el log al arrancar en producción.

## Pasar a datos reales

No cargues pacientes ni datos reales hasta cambiar esto:

| Variable | Valor |
|---|---|
| `AUTH_MODE` | `oidc` (desactiva el ingreso sin contraseña) |
| `ESCULAPIO_MODE` | `real` (necesita que `ESCULAPIO_BASE_URL` sea alcanzable desde Railway) |
| `GOOGLE_AUTH_MODE` | `real`, con `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_REDIRECT_URI=https://<tu-dominio>/auth/google/callback` |
| `WHATSAPP_MODE` | `real`, con `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` y un `WHATSAPP_VERIFY_TOKEN` propio |
| `LLM_MODE` | `real`, con `LLM_BASE_URL`, `LLM_API_KEY` y `LLM_MODEL` |

El webhook de WhatsApp queda en `https://<tu-dominio>/webhook/whatsapp`.

Con `AUTH_MODE=oidc` no hay ingreso de demostración. Antes de cambiarlo, deja definidos los usuarios reales (ingreso por Esculapio o Gmail, o `SKIP_SEED=true` y carga directa en la base).

## Variables opcionales

| Variable | Para qué |
|---|---|
| `WEB_ORIGIN` | Si usas un dominio propio en vez del de Railway. |
| `UPLOAD_DIR`, `STORAGE_DIR` | Carpetas de adjuntos y actas. Con volumen se resuelven solas. |
| `SESSION_TTL_HOURS` | Duración de la sesión (8 por defecto). |
| `TRUST_PROXY_HOPS` | Saltos de proxy de confianza. En Railway queda en 1 sin configurar. |
| `SKIP_SEED` | `true` para no cargar datos base en una base vacía. |

## Si algo falla

| Síntoma en el log | Causa y arreglo |
|---|---|
| `Faltan variables obligatorias: ...` | Falta `DATABASE_URL` o `SECRET_KEY` en el servicio. |
| `No se pudieron aplicar las migraciones` | `DATABASE_URL` mal escrita o la base no está activa. Revisa que la referencia apunte al servicio de PostgreSQL. |
| `/health/ready` responde 503 | La app vive pero no alcanza la base. `/health` solo dice que el proceso está vivo. |
| Los adjuntos o actas desaparecen tras desplegar | Falta el volumen en `/data`. |
| Error de Prisma con `libssl` | La imagen ya instala OpenSSL. Si cambias el `Dockerfile`, conserva ese paso. |

## Probar la imagen en tu equipo

```bash
docker build -t sis-tickets .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://sis:sis@host.docker.internal:5432/sis_tickets" \
  -e SECRET_KEY=prueba sis-tickets
```
