# SIS -- Mesa de Ayuda TI

## Backlog de producto y planificación resumida de Sprints

**Base:** Documentación funcional SIS Mesa de Ayuda TI, versión 3.1.\
**Objetivo:** Construir una primera versión funcional en corto tiempo,
priorizando el registro y atención de tickets, la asignación, el
seguimiento y el cierre.\
**Duración propuesta:** 6 sprints de 1 semana cada uno (6 semanas).\
**Tecnologías:** React + TypeScript, NestJS + TypeScript, PostgreSQL y
Socket.IO.

> La planificación excluye el análisis de Windows Server 2012 R2 y de la
> infraestructura de despliegue.

------------------------------------------------------------------------

## 1. Backlog del producto

  -------------------------------------------------------------------------
  ID                Prioridad         Historia /        Desarrollo
                                      funcionalidad     específico
  ----------------- ----------------- ----------------- -------------------
  HU-01             Alta              Acceso y usuarios Implementar inicio
                                                        de sesión OAuth
                                                        2.0, vinculación
                                                        con usuario de
                                                        Esculapio,
                                                        selección de
                                                        empresa y sede.

  HU-02             Alta              Roles y permisos  Crear roles de
                                                        solicitante,
                                                        analista N1,
                                                        técnico N2,
                                                        especialista N3,
                                                        coordinador y
                                                        administrador.
                                                        Controlar acceso
                                                        por rol.

  HU-03             Alta              Catálogos         Crear mantenimiento
                                                        de usuarios, áreas,
                                                        sedes, ubicaciones,
                                                        categorías,
                                                        subcategorías,
                                                        prioridades y
                                                        estados.

  HU-04             Alta              Registro de       Desarrollar
                                      tickets           formulario web para
                                                        crear tickets con
                                                        categoría,
                                                        descripción,
                                                        ubicación, equipo,
                                                        impacto y
                                                        evidencias. Generar
                                                        consecutivo
                                                        MA-0000.

  HU-05             Alta              Gestión de        Desarrollar
                                      tickets           bandeja, filtros,
                                                        detalle, consulta,
                                                        edición controlada
                                                        y seguimiento de
                                                        tickets.

  HU-06             Alta              Flujo de atención Implementar
                                                        estados,
                                                        prioridades,
                                                        tiempos objetivo y
                                                        niveles N1, N2 y
                                                        N3.

  HU-07             Alta              Asignación y      Asignar
                                      escalamiento      responsables y
                                                        permitir escalar o
                                                        devolver tickets
                                                        registrando motivo
                                                        y acciones
                                                        realizadas.

  HU-08             Alta              Historial y       Registrar mensajes,
                                      conversación      cambios de estado,
                                                        responsables,
                                                        evidencias y
                                                        acciones del
                                                        ticket.

  HU-09             Alta              Notificaciones    Implementar
                                                        notificaciones web
                                                        en tiempo real
                                                        mediante Socket.IO
                                                        y avisos por
                                                        correo.

  HU-10             Media             Base de           Crear módulo de
                                      conocimiento      artículos de
                                                        solución,
                                                        categorías,
                                                        publicación y
                                                        consulta.

  HU-11             Media             Cierre y          Implementar
                                      calificación      confirmación de
                                                        solución,
                                                        reapertura y
                                                        calificación de
                                                        atención de 1 a 5.

  HU-12             Media             WhatsApp Business Integrar recepción
                                                        y envío de mensajes
                                                        mediante Cloud API,
                                                        webhook y
                                                        plantillas
                                                        aprobadas.

  HU-13             Media             Agente IA N1      Implementar
                                                        clasificación,
                                                        preguntas guiadas,
                                                        consulta de
                                                        artículos, creación
                                                        de tickets,
                                                        consulta de estado
                                                        y escalamiento a un
                                                        analista.

  HU-14             Media             Descarte de       Detectar
                                      solicitudes       solicitudes de
                                                        desarrollo de
                                                        software, registrar
                                                        el descarte, enviar
                                                        mensaje de
                                                        redirección y
                                                        permitir revisión o
                                                        reapertura por la
                                                        mesa.

  HU-15             Media             Inventario de     Crear registro de
                                      equipos           equipos con placa,
                                                        serial, tipo,
                                                        marca, modelo,
                                                        sede, área,
                                                        ubicación y
                                                        responsable.

  HU-16             Media             Planes            Crear planes por
                                      preventivos       tipo de equipo,
                                                        frecuencia y
                                                        checklist de
                                                        actividades
                                                        obligatorias.

  HU-17             Media             Calendario y      Generar órdenes
                                      órdenes           según los planes y
                                      preventivas       mostrar calendario
                                                        por sede, área,
                                                        equipo y técnico.

  HU-18             Media             Ejecución         Permitir
                                      preventiva        diligenciar
                                                        checklist,
                                                        registrar
                                                        mediciones,
                                                        fotografías,
                                                        observaciones y
                                                        reprogramaciones.

  HU-19             Media             Actas y firmas    Generar actas para
                                                        correctivos en
                                                        sitio y
                                                        preventivos.
                                                        Implementar firma
                                                        del técnico y
                                                        segundo firmante
                                                        mediante código o
                                                        enlace de WhatsApp.

  HU-20             Media             PDF y cierre de   Generar PDF sellado
                                      actas             con QR, código de
                                                        verificación y hash
                                                        SHA-256. Gestionar
                                                        pendientes,
                                                        rechazos y cierre
                                                        sin firma según
                                                        plazo aprobado.

  HU-21             Baja              Panel principal   Mostrar tickets
                                                        abiertos, resueltos
                                                        por IA,
                                                        distribución por
                                                        nivel, vencimientos
                                                        y actas pendientes.

  HU-22             Baja              Reportes          Generar indicadores
                                                        de tickets por
                                                        nivel, tiempos de
                                                        atención,
                                                        resolución por IA,
                                                        satisfacción y
                                                        equipos con más
                                                        incidencias.
                                                        Exportar a Excel y
                                                        PDF.

  HU-23             Baja              Auditoría y       Consultar
                                      controles         trazabilidad de
                                                        decisiones del
                                                        agente,
                                                        notificaciones,
                                                        cambios de estado,
                                                        escalamientos y
                                                        firmas.
  -------------------------------------------------------------------------

------------------------------------------------------------------------

## 2. Planificación de Sprints

### Sprint 1 -- Estructura y administración

**Duración:** Semana 1\
**Objetivo:** Dejar funcionando la estructura básica del aplicativo.

Desarrollar: - Estructura inicial del frontend React y backend NestJS. -
Modelo de datos y migraciones de PostgreSQL. - Inicio de sesión y
selección de empresa y sede. - Administración de usuarios, roles y
permisos. - Catálogos de áreas, sedes, ubicaciones y categorías. -
Diseño general de la interfaz con tema oscuro.

**Entregable:** Aplicación con acceso, usuarios, permisos y catálogos
funcionando.

### Sprint 2 -- Registro y gestión de tickets

**Duración:** Semana 2\
**Objetivo:** Permitir registrar y administrar solicitudes de soporte.

Desarrollar: - Formulario de creación de tickets. - Generación
automática del número de ticket. - Bandeja de tickets con filtros. -
Detalle del ticket y consulta de información. - Carga y consulta de
evidencias. - Estados, prioridades y tiempos objetivo. - Historial de
cambios del ticket.

**Entregable:** Registro, consulta y seguimiento de tickets desde la
web.

### Sprint 3 -- Atención y escalamiento

**Duración:** Semana 3\
**Objetivo:** Implementar el proceso operativo de soporte técnico.

Desarrollar: - Asignación de tickets a técnicos. - Gestión de niveles
N1, N2 y N3. - Reglas de escalamiento y devolución. - Registro
obligatorio de motivos y acciones. - Conversación y mensajes asociados
al ticket. - Notificaciones en tiempo real con Socket.IO. -
Notificaciones de respaldo por correo. - Confirmación de solución,
reapertura y calificación.

**Entregable:** Flujo completo de atención y seguimiento de tickets.

### Sprint 4 -- WhatsApp y agente IA

**Duración:** Semana 4\
**Objetivo:** Automatizar la atención inicial de los usuarios.

Desarrollar: - Integración con WhatsApp Business Cloud API. - Webhook
para recibir mensajes. - Verificación y asociación del número del
usuario. - Envío y recepción de mensajes. - Base de conocimiento N1. -
Agente IA para clasificar y orientar solicitudes. - Creación y consulta
de tickets desde WhatsApp. - Escalamiento a analista humano. - Detección
y descarte de solicitudes de proyectos de software.

**Entregable:** Atención inicial automatizada por WhatsApp con
supervisión humana.

### Sprint 5 -- Inventario y mantenimiento preventivo

**Duración:** Semana 5\
**Objetivo:** Implementar la gestión del mantenimiento preventivo de
equipos TI.

Desarrollar: - Inventario de equipos. - Registro y configuración de
planes preventivos. - Frecuencias y checklist por tipo de equipo. -
Generación automática de órdenes preventivas. - Calendario de
mantenimientos. - Asignación de técnicos. - Ejecución de órdenes desde
dispositivos móviles. - Registro de mediciones, fotografías y
observaciones. - Historial de mantenimiento por equipo. - Vinculación de
fallas detectadas con tickets correctivos.

**Entregable:** Módulo de mantenimiento preventivo funcional.

### Sprint 6 -- Actas, reportes y entrega

**Duración:** Semana 6\
**Objetivo:** Completar el cierre formal y preparar la entrega del
aplicativo.

Desarrollar: - Generación de actas de cierre. - Firma del técnico y
segundo firmante. - Firma presencial con código de verificación. - Firma
mediante enlace de WhatsApp. - Generación de PDF con QR y hash
SHA-256. - Bandeja de actas pendientes, firmadas y rechazadas. -
Recordatorios y cierre sin firma según plazo aprobado. - Panel principal
con indicadores. - Reportes y exportación a Excel y PDF. - Pruebas
funcionales, permisos y flujos completos. - Corrección de errores y
documentación básica.

**Entregable:** Aplicativo integrado, probado y listo para piloto.

------------------------------------------------------------------------

## 3. Resumen de entregas

  Sprint       Semana Resultado principal
  ---------- -------- ------------------------------------------------------
  Sprint 1          1 Acceso, usuarios, roles y catálogos.
  Sprint 2          2 Registro y administración de tickets.
  Sprint 3          3 Atención, asignación, escalamiento y notificaciones.
  Sprint 4          4 WhatsApp Business y agente IA N1.
  Sprint 5          5 Inventario y mantenimiento preventivo.
  Sprint 6          6 Actas, firmas, reportes, pruebas y entrega.

------------------------------------------------------------------------

## 4. Criterios generales de aceptación

-   Los usuarios ingresan y acceden únicamente a las funcionalidades
    autorizadas por su rol.
-   Se pueden registrar, consultar, asignar y escalar tickets.
-   Cada ticket conserva su historial, evidencias y responsable.
-   Los cambios de estado y las notificaciones se reflejan
    correctamente.
-   El canal web continúa funcionando si WhatsApp o el proveedor de IA
    no están disponibles.
-   El agente IA utiliza únicamente artículos publicados y transfiere
    los casos que no puede resolver.
-   Las solicitudes de desarrollo de software se descartan y quedan
    registradas para revisión.
-   Los mantenimientos preventivos generan órdenes y conservan su
    historial.
-   Las intervenciones en sitio y los preventivos aplicables requieren
    las firmas definidas.
-   Los reportes reflejan la información registrada en el sistema.

------------------------------------------------------------------------

## 5. Recomendaciones para cumplir el tiempo

1.  Trabajar con un equipo pequeño y estable: un responsable
    funcional/Product Owner, un Scrum Master (puede asumirlo un
    integrante del equipo), desarrollador backend, desarrollador
    frontend y apoyo de pruebas.
2.  Realizar una reunión diaria de máximo 15 minutos.
3.  Mantener un único Product Backlog y seleccionar únicamente tareas
    que puedan terminarse dentro del sprint.
4.  Entregar una versión funcional al finalizar cada semana.
5.  Reutilizar componentes visuales y servicios comunes para evitar
    desarrollar funcionalidades duplicadas.
6.  Dejar aprobadas desde el inicio las decisiones pendientes de OAuth,
    Esculapio, proveedor de IA, WhatsApp, tiempos objetivo, inventario y
    firma electrónica.
7.  Si el plazo de seis semanas es inamovible, priorizar el núcleo de
    tickets y soporte. El agente IA avanzado, los preventivos y las
    firmas electrónicas pueden pasar a una segunda entrega si el equipo
    no tiene capacidad suficiente.

**Nota de estimación:** Las seis semanas son una propuesta de
planificación acelerada, no una garantía de duración. Dependen del
tamaño y experiencia del equipo, de la disponibilidad de integraciones y
de que las decisiones funcionales pendientes se resuelvan oportunamente.
