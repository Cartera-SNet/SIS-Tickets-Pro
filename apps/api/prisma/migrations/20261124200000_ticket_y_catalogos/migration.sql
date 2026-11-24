ALTER TABLE "prioridades" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "consecutivos" (
    "prefijo" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "consecutivos_pkey" PRIMARY KEY ("prefijo")
);

INSERT INTO "consecutivos" ("prefijo", "valor") VALUES ('MA', 0), ('PV', 0);

CREATE TABLE "ans_versiones" (
    "id" UUID NOT NULL,
    "prioridad_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "primera_respuesta_valor" INTEGER NOT NULL,
    "primera_respuesta_unidad" "UnidadTiempo" NOT NULL,
    "solucion_valor" INTEGER NOT NULL,
    "solucion_unidad" "UnidadTiempo" NOT NULL,
    "usuario_id" UUID,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ans_versiones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ans_versiones_prioridad_id_version_key" ON "ans_versiones"("prioridad_id", "version");

ALTER TABLE "ans_versiones"
  ADD CONSTRAINT "ans_versiones_prioridad_id_fkey"
  FOREIGN KEY ("prioridad_id") REFERENCES "prioridades"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
