ALTER TABLE "base_conocimiento" ADD COLUMN "casos_resueltos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "base_conocimiento" ADD COLUMN "reclasificaciones" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "mensajes_entrantes" (
    "id_meta" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "recibido" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mensajes_entrantes_pkey" PRIMARY KEY ("id_meta")
);

CREATE INDEX "mensajes_entrantes_telefono_recibido_idx" ON "mensajes_entrantes"("telefono", "recibido");

CREATE TABLE "envios_whatsapp" (
    "id_meta" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "plantilla" TEXT,
    "estado" "EstadoEntrega" NOT NULL DEFAULT 'ENVIADO',
    "actualizado" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "envios_whatsapp_pkey" PRIMARY KEY ("id_meta")
);

CREATE INDEX "envios_whatsapp_telefono_idx" ON "envios_whatsapp"("telefono");
