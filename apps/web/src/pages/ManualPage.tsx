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
      'Puedes adjuntar evidencias (imágenes, PDF o texto) al crearlo.',
      'Al enviar, recibes un número de ticket para hacer seguimiento.',
    ],
  },
  {
    titulo: 'Tickets',
    quien: 'Todos',
    pasos: [
      'Muestra la bandeja de casos. El solicitante ve los suyos; el equipo ve los de su sede.',
      'Entra a un ticket para ver el detalle, la conversación, las evidencias y el historial.',
      'En el detalle, la pestaña «Evidencias» permite ver y agregar archivos; la conversación permite escribir con soporte.',
      'Cuando soporte resuelve el caso, el solicitante lo confirma o lo rechaza desde el detalle.',
    ],
  },
  {
    titulo: 'Asignación y descartes',
    quien: 'Técnico / Administrador',
    pasos: ['Asignación: reparte los casos entre técnicos según su nivel y carga.', 'Descartes: revisa casos que se descartaron y por qué.'],
  },
  {
    titulo: 'Agente IA (N1)',
    quien: 'Técnico / Administrador',
    pasos: ['Muestra lo que el agente atendió por WhatsApp y los casos que pasó a una persona.'],
  },
  {
    titulo: 'Mantenimiento preventivo',
    quien: 'Técnico / Administrador',
    pasos: ['Lista las órdenes de mantenimiento programadas y el historial de cada equipo.', 'Abre una orden para llenar el checklist y cerrarla.'],
  },
  {
    titulo: 'Actas de cierre',
    quien: 'Técnico / Administrador',
    pasos: ['Genera el acta de un caso resuelto, la envía a firma y guarda el PDF.', 'Cualquier persona puede verificar un acta en la página «Verificar» con su código.'],
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
