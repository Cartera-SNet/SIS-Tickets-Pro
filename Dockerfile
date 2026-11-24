# Imagen única: compila shared, API y web, y sirve todo desde el proceso de la API.
FROM node:22-bookworm-slim

# Prisma necesita OpenSSL para su motor de consultas.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Primero los manifiestos: la capa de dependencias se reutiliza si no cambian.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --include=dev

COPY . .
RUN npm run build

# NODE_ENV se fija después de compilar para no omitir las dependencias de desarrollo
# (Prisma CLI y tsx se usan al arrancar para migrar y cargar datos base).
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "scripts/start.mjs"]
