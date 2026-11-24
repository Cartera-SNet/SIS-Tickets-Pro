# Proxy y servicio del backend

Diseño del sprint 1. No se despliega en el servidor actual.

## Bloqueo de producción

El servidor descrito es Windows Server 2012 R2, sin soporte desde octubre de 2023. Las versiones LTS actuales de Node.js no lo soportan. Producción necesita Windows Server 2019/2022 o Linux. En el PC de desarrollo no afecta.

La única ruta que sale a internet es el webhook de WhatsApp: `POST /webhook/whatsapp` (llega en el sprint 6). El resto queda en la red interna.

## Rutas

El proxy termina TLS y reparte así:

| Ruta pública | Destino |
|---|---|
| `/` | build de React |
| `/api/*` | NestJS |
| `/health` | NestJS (también existe `/api/health`) |
| `/socket.io/*` | NestJS, a partir del sprint 8 |
| `/webhook/*` | NestJS |

## Nginx

```nginx
server {
    listen 443 ssl;
    server_name mesa.example.internal;

    ssl_certificate     /etc/ssl/mesa.crt;
    ssl_certificate_key /etc/ssl/mesa.key;

    root /var/www/sis-tickets;
    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /webhook/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

## IIS

Con URL Rewrite y Application Request Routing:

- El sitio sirve el build de `apps/web/dist`.
- Regla inversa de `/api`, `/health`, `/socket.io` y `/webhook` hacia `http://127.0.0.1:3000`, conservando el camino.
- Enlace HTTPS con el certificado de la organización.
- WebSocket habilitado en ARR para `/socket.io` cuando exista el gateway.

## Servicio del backend

Linux: unidad systemd que ejecuta `node dist/main.js` con `WorkingDirectory` en `apps/api` y el entorno fuera del repositorio.

Windows Server compatible: servicio que arranca el mismo comando. No usar el equipo de desarrollo como servidor público.

El pipeline copia el build a staging solo si existen `STAGING_HOST`, `STAGING_USER` y `STAGING_PATH`. Ver `.github/workflows/ci.yml`.
