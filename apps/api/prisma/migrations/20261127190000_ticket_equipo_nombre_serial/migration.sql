-- Nombre y serial del equipo reportado en el alta (script Windows / formulario).
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "equipo_nombre" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "equipo_serial" TEXT;
