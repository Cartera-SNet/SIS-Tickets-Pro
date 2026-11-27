SIS Mesa de Ayuda — Obtener datos del equipo (Windows)
=====================================================

1. Descarga el archivo obtener-equipo-sis.ps1 desde la app (botón «Obtener datos del equipo»
   en Nuevo ticket) o cópialo desde esta carpeta.
2. Clic derecho → «Ejecutar con PowerShell».
   Si Windows bloquea el script: abre PowerShell y ejecuta:
   powershell -ExecutionPolicy Bypass -File .\obtener-equipo-sis.ps1
3. El script lee el nombre ($env:COMPUTERNAME) y el serial del BIOS, y abre el navegador en:
   https://tickets-sis.up.railway.app/tickets/nuevo?equipo=NOMBRE&serial=SERIAL
4. El formulario rellena Equipo (nombre + serial). Puedes editarlos a mano si hace falta.

Despliegue / IT
---------------
- Publica el .ps1 en una carpeta compartida o en el propio sitio (/scripts/).
- Opcional: define SIS_TICKETS_URL=https://tu-dominio para apuntar a otro entorno.
- No requiere instalación ni privilegios de administrador en la mayoría de equipos.
