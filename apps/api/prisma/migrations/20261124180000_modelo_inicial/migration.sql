-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('SOLICITANTE', 'TECNICO', 'ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "NivelAtencion" AS ENUM ('N1', 'N2', 'N3');

-- CreateEnum
CREATE TYPE "EstadoAprobacion" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('WEB', 'WHATSAPP', 'CORREO');

-- CreateEnum
CREATE TYPE "TipoTicket" AS ENUM ('CORRECTIVO', 'PREVENTIVO');

-- CreateEnum
CREATE TYPE "EstadoTicket" AS ENUM ('NUEVO', 'EN_ATENCION_N1', 'ESCALADO', 'ASIGNADO', 'EN_SITIO', 'EN_PROCESO', 'ESPERANDO_USUARIO', 'ESPERANDO_REPUESTO', 'RESUELTO', 'CERRADO', 'PENDIENTE_DE_FIRMA', 'CERRADO_CON_ACTA', 'CERRADO_SIN_FIRMA', 'FIRMA_RECHAZADA', 'DESCARTADO', 'CANCELADO', 'REABIERTO');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('PROGRAMADA', 'ASIGNADA', 'EN_EJECUCION', 'PENDIENTE_DE_FIRMA', 'CERRADA_CON_ACTA', 'REPROGRAMADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "EstadoActa" AS ENUM ('PENDIENTE_DE_FIRMA', 'CERRADO_CON_ACTA', 'CERRADO_SIN_FIRMA', 'FIRMA_RECHAZADA');

-- CreateEnum
CREATE TYPE "EstadoConocimiento" AS ENUM ('BORRADOR', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "FrecuenciaPreventivo" AS ENUM ('TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "UnidadTiempo" AS ENUM ('MINUTOS', 'HORAS', 'DIAS_HABILES');

-- CreateEnum
CREATE TYPE "AutorMensaje" AS ENUM ('USUARIO', 'TECNICO', 'AGENTE_IA');

-- CreateEnum
CREATE TYPE "EstadoEntrega" AS ENUM ('PENDIENTE', 'ENVIADO', 'ENTREGADO', 'LEIDO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "TipoConfiguracion" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "MetodoAuth" AS ENUM ('ESCULAPIO', 'GOOGLE', 'DEV');

-- CreateEnum
CREATE TYPE "MetodoFirma" AS ENUM ('DISPOSITIVO_TECNICO', 'ENLACE', 'CORREO', 'SESION_WEB');

-- CreateEnum
CREATE TYPE "ResultadoFirma" AS ENUM ('FIRMO', 'RECHAZO');

-- CreateTable
CREATE TABLE "tipos_personal" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "celular_permitido" BOOLEAN NOT NULL DEFAULT true,
    "canal_preferido" "Canal" NOT NULL DEFAULT 'WEB',
    "regla_prioridad_sugerida" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tipos_personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sedes" (
    "id" UUID NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "codigo_esculapio" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "celular_permitido" BOOLEAN,
    "sede_id" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones" (
    "id" UUID NOT NULL,
    "sede_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "piso" TEXT,
    "puesto" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "correo_google" TEXT,
    "usuario_esculapio" TEXT,
    "servidor_esculapio" TEXT,
    "estado_aprobacion" "EstadoAprobacion" NOT NULL DEFAULT 'PENDIENTE',
    "nombre" TEXT NOT NULL,
    "celular" TEXT,
    "celular_verificado" BOOLEAN NOT NULL DEFAULT false,
    "correo_notificaciones" TEXT,
    "autorizacion_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "autorizacion_whatsapp_version" TEXT,
    "rol" "Rol" NOT NULL,
    "es_jefe_area" BOOLEAN NOT NULL DEFAULT false,
    "tipo_personal_id" UUID NOT NULL,
    "area_id" UUID,
    "sede_id" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_niveles_atencion" (
    "usuario_id" UUID NOT NULL,
    "nivel" "NivelAtencion" NOT NULL,

    CONSTRAINT "usuarios_niveles_atencion_pkey" PRIMARY KEY ("usuario_id","nivel")
);

-- CreateTable
CREATE TABLE "roles_permisos" (
    "id" UUID NOT NULL,
    "rol" "Rol" NOT NULL,
    "permiso" TEXT NOT NULL,

    CONSTRAINT "roles_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategorias" (
    "id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subcategorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prioridades" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "primera_respuesta_valor" INTEGER NOT NULL,
    "primera_respuesta_unidad" "UnidadTiempo" NOT NULL,
    "solucion_valor" INTEGER NOT NULL,
    "solucion_unidad" "UnidadTiempo" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "prioridades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estados" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ambito" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "estados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "niveles" (
    "id" UUID NOT NULL,
    "codigo" "NivelAtencion" NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "niveles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipos" (
    "id" UUID NOT NULL,
    "placa" TEXT,
    "serial" TEXT,
    "tipo" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "sede_id" UUID NOT NULL,
    "area_id" UUID,
    "ubicacion_id" UUID,
    "responsable_id" UUID,
    "estado" TEXT NOT NULL DEFAULT 'Operativo',
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "equipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" "TipoTicket" NOT NULL,
    "canal_origen" "Canal" NOT NULL,
    "solicitante_id" UUID NOT NULL,
    "categoria_id" UUID,
    "subcategoria_id" UUID,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "sede_id" UUID,
    "ubicacion_id" UUID,
    "equipo_id" UUID,
    "impacto_puede_trabajar" BOOLEAN,
    "impacto_personas" INTEGER,
    "prioridad_id" UUID,
    "nivel" "NivelAtencion" NOT NULL DEFAULT 'N1',
    "responsable_id" UUID,
    "fecha_objetivo_primera_respuesta" TIMESTAMPTZ(6),
    "fecha_objetivo_solucion" TIMESTAMPTZ(6),
    "solucion_aplicada" TEXT,
    "calificacion" INTEGER,
    "motivo_descarte" TEXT,
    "regla_descarte" TEXT,
    "mensaje_redireccion" TEXT,
    "estado" "EstadoTicket" NOT NULL DEFAULT 'NUEVO',
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_resolucion" TIMESTAMPTZ(6),
    "fecha_cierre" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalamientos" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "nivel_origen" "NivelAtencion" NOT NULL,
    "nivel_destino" "NivelAtencion" NOT NULL,
    "motivo" TEXT NOT NULL,
    "acciones" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalamientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "autor_tipo" "AutorMensaje" NOT NULL,
    "autor_id" UUID,
    "canal" "Canal" NOT NULL,
    "contenido" TEXT NOT NULL,
    "adjunto_id" UUID,
    "estado_entrega" "EstadoEntrega" NOT NULL DEFAULT 'PENDIENTE',
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversaciones_ia" (
    "id" UUID NOT NULL,
    "celular" TEXT,
    "usuario_id" UUID,
    "ticket_id" UUID,
    "decisiones" JSONB NOT NULL DEFAULT '[]',
    "confianza" DECIMAL(5,4),
    "articulo_id" UUID,
    "transferencia" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversaciones_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "base_conocimiento" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria_id" UUID,
    "pasos" TEXT NOT NULL,
    "estado" "EstadoConocimiento" NOT NULL DEFAULT 'BORRADOR',
    "usos" INTEGER NOT NULL DEFAULT 0,
    "efectividad" DECIMAL(5,2),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "base_conocimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_whatsapp" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "idioma" TEXT NOT NULL DEFAULT 'es',
    "estado_aprobacion" TEXT NOT NULL DEFAULT 'pendiente',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plantillas_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes_preventivos" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo_equipo" TEXT NOT NULL,
    "frecuencia" "FrecuenciaPreventivo" NOT NULL,
    "anticipacion_dias" INTEGER NOT NULL DEFAULT 15,
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "planes_preventivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_preventivas" (
    "id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "plan_id" UUID NOT NULL,
    "equipo_id" UUID NOT NULL,
    "fecha_programada" TIMESTAMPTZ(6) NOT NULL,
    "tecnico_id" UUID,
    "estado" "EstadoOrden" NOT NULL DEFAULT 'PROGRAMADA',
    "resultados" JSONB NOT NULL DEFAULT '[]',
    "reprogramaciones" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ordenes_preventivas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actas" (
    "id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ticket_id" UUID,
    "orden_id" UUID,
    "contenido" JSONB NOT NULL,
    "estado" "EstadoActa" NOT NULL DEFAULT 'PENDIENTE_DE_FIRMA',
    "pdf_ruta" TEXT,
    "hash" TEXT,
    "codigo_verificacion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firmas" (
    "id" UUID NOT NULL,
    "acta_id" UUID NOT NULL,
    "firmante_id" UUID NOT NULL,
    "rol" TEXT NOT NULL,
    "metodo" "MetodoFirma" NOT NULL,
    "imagen" BYTEA,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "numero_verificado" TEXT,
    "dispositivo" TEXT,
    "ip" TEXT,
    "resultado" "ResultadoFirma" NOT NULL,
    "motivo_rechazo" TEXT,

    CONSTRAINT "firmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjuntos" (
    "id" UUID NOT NULL,
    "ticket_id" UUID,
    "nombre" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "hash" TEXT,
    "subido_por_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial" (
    "id" UUID NOT NULL,
    "ticket_id" UUID,
    "orden_id" UUID,
    "usuario_id" UUID,
    "tipo" TEXT NOT NULL,
    "datos_previos" JSONB,
    "datos_nuevos" JSONB,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "evento" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones_entregas" (
    "id" UUID NOT NULL,
    "notificacion_id" UUID NOT NULL,
    "canal" "Canal" NOT NULL,
    "estado" "EstadoEntrega" NOT NULL DEFAULT 'PENDIENTE',
    "detalle" TEXT,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_entregas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecturas_notificacion" (
    "id" UUID NOT NULL,
    "notificacion_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecturas_notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "tipo" "TipoConfiguracion" NOT NULL,
    "descripcion" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "delegados_area" (
    "id" UUID NOT NULL,
    "jefe_id" UUID NOT NULL,
    "delegado_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegados_area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_firma" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "acta_id" UUID NOT NULL,
    "hash" TEXT NOT NULL,
    "expira" TIMESTAMPTZ(6) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "codigos_firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_firma" (
    "id" UUID NOT NULL,
    "acta_id" UUID NOT NULL,
    "firmante_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "vence" TIMESTAMPTZ(6) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "metodo_auth" "MetodoAuth" NOT NULL,
    "empresa_codigo" TEXT,
    "sede_id" UUID,
    "expira" TIMESTAMPTZ(6) NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sedes_codigo_esculapio_idx" ON "sedes"("codigo_esculapio");

-- CreateIndex
CREATE INDEX "areas_sede_id_idx" ON "areas"("sede_id");

-- CreateIndex
CREATE INDEX "ubicaciones_sede_id_idx" ON "ubicaciones"("sede_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_google_key" ON "usuarios"("correo_google");

-- CreateIndex
CREATE INDEX "usuarios_celular_idx" ON "usuarios"("celular");

-- CreateIndex
CREATE INDEX "usuarios_sede_id_idx" ON "usuarios"("sede_id");

-- CreateIndex
CREATE INDEX "usuarios_rol_idx" ON "usuarios"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_usuario_esculapio_servidor_esculapio_key" ON "usuarios"("usuario_esculapio", "servidor_esculapio");

-- CreateIndex
CREATE UNIQUE INDEX "roles_permisos_rol_permiso_key" ON "roles_permisos"("rol", "permiso");

-- CreateIndex
CREATE INDEX "subcategorias_categoria_id_idx" ON "subcategorias"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "prioridades_codigo_key" ON "prioridades"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estados_ambito_codigo_key" ON "estados"("ambito", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "niveles_codigo_key" ON "niveles"("codigo");

-- CreateIndex
CREATE INDEX "equipos_placa_idx" ON "equipos"("placa");

-- CreateIndex
CREATE INDEX "equipos_serial_idx" ON "equipos"("serial");

-- CreateIndex
CREATE INDEX "equipos_sede_id_idx" ON "equipos"("sede_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_numero_key" ON "tickets"("numero");

-- CreateIndex
CREATE INDEX "tickets_estado_idx" ON "tickets"("estado");

-- CreateIndex
CREATE INDEX "tickets_nivel_idx" ON "tickets"("nivel");

-- CreateIndex
CREATE INDEX "tickets_sede_id_idx" ON "tickets"("sede_id");

-- CreateIndex
CREATE INDEX "tickets_responsable_id_idx" ON "tickets"("responsable_id");

-- CreateIndex
CREATE INDEX "tickets_solicitante_id_idx" ON "tickets"("solicitante_id");

-- CreateIndex
CREATE INDEX "tickets_fecha_objetivo_primera_respuesta_idx" ON "tickets"("fecha_objetivo_primera_respuesta");

-- CreateIndex
CREATE INDEX "tickets_fecha_objetivo_solucion_idx" ON "tickets"("fecha_objetivo_solucion");

-- CreateIndex
CREATE INDEX "escalamientos_ticket_id_idx" ON "escalamientos"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "mensajes_adjunto_id_key" ON "mensajes"("adjunto_id");

-- CreateIndex
CREATE INDEX "mensajes_ticket_id_fecha_idx" ON "mensajes"("ticket_id", "fecha");

-- CreateIndex
CREATE INDEX "conversaciones_ia_usuario_id_idx" ON "conversaciones_ia"("usuario_id");

-- CreateIndex
CREATE INDEX "conversaciones_ia_ticket_id_idx" ON "conversaciones_ia"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "base_conocimiento_codigo_key" ON "base_conocimiento"("codigo");

-- CreateIndex
CREATE INDEX "base_conocimiento_estado_idx" ON "base_conocimiento"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "plantillas_whatsapp_nombre_key" ON "plantillas_whatsapp"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_preventivas_numero_key" ON "ordenes_preventivas"("numero");

-- CreateIndex
CREATE INDEX "ordenes_preventivas_estado_idx" ON "ordenes_preventivas"("estado");

-- CreateIndex
CREATE INDEX "ordenes_preventivas_fecha_programada_idx" ON "ordenes_preventivas"("fecha_programada");

-- CreateIndex
CREATE INDEX "ordenes_preventivas_tecnico_id_idx" ON "ordenes_preventivas"("tecnico_id");

-- CreateIndex
CREATE UNIQUE INDEX "actas_codigo_verificacion_key" ON "actas"("codigo_verificacion");

-- CreateIndex
CREATE INDEX "actas_ticket_id_idx" ON "actas"("ticket_id");

-- CreateIndex
CREATE INDEX "actas_orden_id_idx" ON "actas"("orden_id");

-- CreateIndex
CREATE INDEX "actas_estado_idx" ON "actas"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "actas_numero_version_key" ON "actas"("numero", "version");

-- CreateIndex
CREATE INDEX "firmas_acta_id_idx" ON "firmas"("acta_id");

-- CreateIndex
CREATE INDEX "adjuntos_ticket_id_idx" ON "adjuntos"("ticket_id");

-- CreateIndex
CREATE INDEX "historial_ticket_id_fecha_idx" ON "historial"("ticket_id", "fecha");

-- CreateIndex
CREATE INDEX "historial_orden_id_idx" ON "historial"("orden_id");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_fecha_idx" ON "notificaciones"("usuario_id", "fecha");

-- CreateIndex
CREATE INDEX "notificaciones_entregas_notificacion_id_idx" ON "notificaciones_entregas"("notificacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "lecturas_notificacion_notificacion_id_usuario_id_key" ON "lecturas_notificacion"("notificacion_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "delegados_area_delegado_id_area_id_key" ON "delegados_area"("delegado_id", "area_id");

-- CreateIndex
CREATE INDEX "codigos_firma_acta_id_idx" ON "codigos_firma"("acta_id");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_firma_token_hash_key" ON "tokens_firma"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_firma_acta_id_idx" ON "tokens_firma"("acta_id");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_token_hash_key" ON "sesiones"("token_hash");

-- CreateIndex
CREATE INDEX "sesiones_usuario_id_idx" ON "sesiones"("usuario_id");

-- CreateIndex
CREATE INDEX "sesiones_expira_idx" ON "sesiones"("expira");

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tipo_personal_id_fkey" FOREIGN KEY ("tipo_personal_id") REFERENCES "tipos_personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_niveles_atencion" ADD CONSTRAINT "usuarios_niveles_atencion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategorias" ADD CONSTRAINT "subcategorias_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_subcategoria_id_fkey" FOREIGN KEY ("subcategoria_id") REFERENCES "subcategorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_prioridad_id_fkey" FOREIGN KEY ("prioridad_id") REFERENCES "prioridades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalamientos" ADD CONSTRAINT "escalamientos_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalamientos" ADD CONSTRAINT "escalamientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_adjunto_id_fkey" FOREIGN KEY ("adjunto_id") REFERENCES "adjuntos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones_ia" ADD CONSTRAINT "conversaciones_ia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones_ia" ADD CONSTRAINT "conversaciones_ia_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones_ia" ADD CONSTRAINT "conversaciones_ia_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "base_conocimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "base_conocimiento" ADD CONSTRAINT "base_conocimiento_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_preventivas" ADD CONSTRAINT "ordenes_preventivas_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes_preventivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_preventivas" ADD CONSTRAINT "ordenes_preventivas_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_preventivas" ADD CONSTRAINT "ordenes_preventivas_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas" ADD CONSTRAINT "actas_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas" ADD CONSTRAINT "actas_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_preventivas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firmas" ADD CONSTRAINT "firmas_acta_id_fkey" FOREIGN KEY ("acta_id") REFERENCES "actas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firmas" ADD CONSTRAINT "firmas_firmante_id_fkey" FOREIGN KEY ("firmante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial" ADD CONSTRAINT "historial_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial" ADD CONSTRAINT "historial_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_preventivas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial" ADD CONSTRAINT "historial_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones_entregas" ADD CONSTRAINT "notificaciones_entregas_notificacion_id_fkey" FOREIGN KEY ("notificacion_id") REFERENCES "notificaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturas_notificacion" ADD CONSTRAINT "lecturas_notificacion_notificacion_id_fkey" FOREIGN KEY ("notificacion_id") REFERENCES "notificaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturas_notificacion" ADD CONSTRAINT "lecturas_notificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegados_area" ADD CONSTRAINT "delegados_area_jefe_id_fkey" FOREIGN KEY ("jefe_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegados_area" ADD CONSTRAINT "delegados_area_delegado_id_fkey" FOREIGN KEY ("delegado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegados_area" ADD CONSTRAINT "delegados_area_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_firma" ADD CONSTRAINT "codigos_firma_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_firma" ADD CONSTRAINT "codigos_firma_acta_id_fkey" FOREIGN KEY ("acta_id") REFERENCES "actas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_firma" ADD CONSTRAINT "tokens_firma_acta_id_fkey" FOREIGN KEY ("acta_id") REFERENCES "actas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_firma" ADD CONSTRAINT "tokens_firma_firmante_id_fkey" FOREIGN KEY ("firmante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
