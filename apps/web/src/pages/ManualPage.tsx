// Manual de usuario dentro de la app. Mantenerlo al día cuando cambie una pantalla o función.
type Seccion = { titulo: string; quien: string; pasos: string[] };

const SECCIONES: Seccion[] = [
  {
    titulo: 'Inicio',
    quien: 'Todos',
    pasos: ['Es el resumen del día: casos abiertos, vencimientos y accesos rápidos.', 'Desde aquí puedes ir a tus tickets o crear uno nuevo.'],
  },
  {
    titulo: 'Nuevo ticket',
    quien: 'Solicitante',
    pasos: [
      'Describe el problema con claridad: qué pasó y en qué equipo o sede.',
      'El campo Equipo puede precargarse con el script Windows «Obtener datos del equipo» (nombre y serial). Sigue siendo editable.',
      'Puedes adjuntar evidencias (imágenes, PDF o texto) al crearlo.',
      'Al enviar, recibes un número de ticket para hacer seguimiento.',
    ],
  },
  {
    titulo: 'Tickets',
    quien: 'Todos',
    pasos: [
      'Muestra la bandeja de casos. El solicitante ve los suyos; el equipo ve los de su sede (se actualiza en vivo al crear).',
      'Entra a un ticket para ver el detalle, la conversación, las evidencias de avance y el historial.',
      'Escalar exige motivo, acciones realizadas y asignar un técnico o al administrador (desde N2 solo a N3).',
      'El técnico avisa la solución; el solicitante confirma o indica que aún no está solucionada. Sin respuesta en 24 h se cierra.',
      'El acta de cierre (N2/N3) se genera desde la pestaña Seguimiento con los datos ya registrados.',
    ],
  },
  {
    titulo: 'Asignación y descartes',
    quien: 'Técnico / Administrador',
    pasos: ['Asignación: reparte los casos entre técnicos según su nivel y carga.', 'Descartes: revisa casos que se descartaron y por qué.'],
  },
  {
    titulo: 'Agente IA (N1)',
    quien: 'Todos',
    pasos: [
      'El ícono flotante del agente está disponible para Solicitante, Técnicos y Administrador.',
      'Úsalo para consultar problemas de equipo, red o apps básicas. Los técnicos también ven la supervisión de WhatsApp.',
    ],
  },
  {
    titulo: 'Mantenimiento preventivo',
    quien: 'Técnico / Administrador',
    pasos: ['Lista las órdenes de mantenimiento programadas y el historial de cada equipo.', 'Abre una orden para llenar el checklist y cerrarla.'],
  },
  {
    titulo: 'Actas de cierre',
    quien: 'Técnico / Administrador',
    pasos: [
      'Genera el acta desde el seguimiento del ticket: incluye ID/consecutivo, equipo, fechas, solución, evidencias y confirmación.',
      'Cualquier persona puede verificar un acta en la página «Verificar» con su código.',
    ],
  },
  {
    titulo: 'Script Windows · datos del equipo',
    quien: 'Solicitante / TI',
    pasos: [
      'Descarga /scripts/obtener-equipo-sis.ps1 desde Nuevo ticket.',
      'Ejecútalo con PowerShell; abre el formulario con ?equipo= y ?serial= precargados.',
      'Documentación: docs/equipo-script-windows.md',
    ],
  },
  {
    titulo: 'Notificaciones',
    quien: 'Todos',
    pasos: ['Avisos de tus casos (respuestas, cambios de estado, vencimientos).'],
  },
  {
    titulo: 'Base de conocimiento',
    quien: 'Técnico / Administrador',
    pasos: ['Artículos con soluciones frecuentes; el agente los usa para responder.'],
  },
  {
    titulo: 'Reportes',
    quien: 'Administrador',
    pasos: ['Cifras de atención: casos por estado, tiempos y cumplimiento de ANS.'],
  },
  {
    titulo: 'Configuración',
    quien: 'Administrador',
    pasos: ['Catálogos (sedes, categorías, prioridades), usuarios y permisos, matriz de notificaciones, agente y plantillas.'],
  },
];

export function ManualPage() {
  return (
    <section>
      <h1>Manual de usuario</h1>
      <p>Qué hace cada pantalla y cómo usarla. Solo verás en el menú las que tu rol permite.</p>
      {SECCIONES.map((seccion) => (
        <article className="panel-tarjeta" key={seccion.titulo}>
          <h2>{seccion.titulo}</h2>
          <p>
            <strong>Quién la usa:</strong> {seccion.quien}
          </p>
          <ul>
            {seccion.pasos.map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
