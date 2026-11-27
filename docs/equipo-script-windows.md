# Script Windows: nombre y serial del equipo

El navegador no puede leer el serial del BIOS. Por eso se entrega un lanzador PowerShell liviano.

## Qué hace

1. Lee el nombre: `$env:COMPUTERNAME` (o hostname).
2. Lee el serial: `Get-CimInstance Win32_BIOS` y, si falla, `wmic bios get serialnumber`.
3. Abre `/tickets/nuevo?equipo=...&serial=...` en el navegador.

Archivos publicados con la web:

- `/scripts/obtener-equipo-sis.ps1`
- `/scripts/README-equipo.txt`

## Despliegue

Tras el build/deploy de Railway, las rutas anteriores quedan disponibles en el dominio público.
El área de TI puede copiar el `.ps1` a una carpeta compartida o un acceso directo en el escritorio.

Variable opcional: `SIS_TICKETS_URL` (sin barra final) para apuntar a otro entorno.
