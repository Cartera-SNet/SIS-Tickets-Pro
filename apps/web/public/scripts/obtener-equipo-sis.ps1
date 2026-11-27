# SIS Mesa de Ayuda — obtiene nombre y serial del equipo y abre el formulario Nuevo ticket.
# Uso: clic derecho → Ejecutar con PowerShell (o desde una consola: powershell -ExecutionPolicy Bypass -File .\obtener-equipo-sis.ps1)

$ErrorActionPreference = 'SilentlyContinue'
$baseUrl = if ($env:SIS_TICKETS_URL) { $env:SIS_TICKETS_URL.TrimEnd('/') } else { 'https://tickets-sis.up.railway.app' }

$nombre = $env:COMPUTERNAME
if (-not $nombre) {
  try { $nombre = [System.Net.Dns]::GetHostName() } catch { $nombre = 'EQUIPO' }
}

$serial = $null
try {
  $serial = (Get-CimInstance -ClassName Win32_BIOS).SerialNumber
} catch {
  $serial = $null
}
if (-not $serial) {
  try {
    $linea = (wmic bios get serialnumber /value | Where-Object { $_ -match 'SerialNumber=' })
    if ($linea) { $serial = ($linea -split '=', 2)[1].Trim() }
  } catch {
    $serial = ''
  }
}
if (-not $serial) { $serial = 'DESCONOCIDO' }

$nombreEnc = [uri]::EscapeDataString($nombre.Trim())
$serialEnc = [uri]::EscapeDataString($serial.Trim())
$url = "$baseUrl/tickets/nuevo?equipo=$nombreEnc&serial=$serialEnc"

Write-Host "Equipo: $nombre"
Write-Host "Serial: $serial"
Write-Host "Abriendo: $url"
Start-Process $url
