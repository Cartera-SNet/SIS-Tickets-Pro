-- Evidencias en Neon/Postgres para no depender del disco efímero de Railway.
ALTER TABLE "adjuntos" ADD COLUMN "contenido" BYTEA;
