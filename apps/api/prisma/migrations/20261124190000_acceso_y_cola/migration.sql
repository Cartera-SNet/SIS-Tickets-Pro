-- Sprint 2: sesión previa, límite de intentos, celular y ubicación habitual.

ALTER TABLE "usuarios" ADD COLUMN "ubicacion_habitual_id" UUID;
ALTER TABLE "usuarios" ADD COLUMN "consentimiento_datos_version" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "consentimiento_datos_fecha" TIMESTAMPTZ(6);

ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_ubicacion_habitual_id_fkey"
  FOREIGN KEY ("ubicacion_habitual_id") REFERENCES "ubicaciones"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "intentos_acceso" (
    "ip" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "primer_intento" TIMESTAMPTZ(6) NOT NULL,
    "bloqueado_hasta" TIMESTAMPTZ(6),
    CONSTRAINT "intentos_acceso_pkey" PRIMARY KEY ("ip")
);

CREATE TABLE "preautenticaciones" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "metodo" "MetodoAuth" NOT NULL,
    "usuario_esculapio" TEXT,
    "servidor_esculapio" TEXT,
    "correo_google" TEXT,
    "nombre" TEXT,
    "empresas" JSONB NOT NULL DEFAULT '[]',
    "state" TEXT,
    "code_verifier" TEXT,
    "expira" TIMESTAMPTZ(6) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "preautenticaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "preautenticaciones_token_hash_key" ON "preautenticaciones"("token_hash");
CREATE UNIQUE INDEX "preautenticaciones_state_key" ON "preautenticaciones"("state");

CREATE TABLE "codigos_celular" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "celular" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "expira" TIMESTAMPTZ(6) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "codigos_celular_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "codigos_celular_usuario_id_idx" ON "codigos_celular"("usuario_id");

ALTER TABLE "codigos_celular"
  ADD CONSTRAINT "codigos_celular_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
