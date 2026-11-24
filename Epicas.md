## EPICAS Del Proyecto
### Es una historia de usuario de gran tamaño y alcance que resulta demasiado extensa para completarse en un único sprint

### E1 · Fundamentos de plataforma

| ID | Historia de usuario | Criterio de aceptación (resumido) | Pts | Sprint |
|---|---|---|---|---|
| US-01 | Como desarrollo, quiero el modelo de datos de PostgreSQL 16 | Tablas del modelo propuesto (usuarios, tickets, escalamientos, mensajes, conversaciones_ia, base_conocimiento, plantillas_whatsapp, equipos, planes_preventivos, ordenes_preventivas, actas, firmas, catálogos, adjuntos, notificaciones) con migraciones versionadas | 8 | S1 |
| US-02 | Como desarrollo, quiero el backend NestJS modular | Módulos de la doc (auth, tickets, niveles, agente, whatsapp, notificaciones, KB, catálogos, reportes, administración), `GET /health`, config por variables de entorno | 5 | S1 |
| US-03 | Como usuario, quiero la base del frontend en tema oscuro | React Router, cliente HTTP autenticado, tema oscuro (fondo azul noche, acentos turquesa/verde, ámbar y rojo), layout adaptable a móvil | 8 | S1 |
| US-04 | Como equipo, quiero integración continua | Pipeline de build, lint, test, migrate y deploy a *staging*; `.env.example`; guía de ejecución | 5 | S1 |
| US-05 | Como administrador, quiero un punto de entrada único | Proxy inverso con TLS enrutando `/api`, `/socket.io` y `/webhook/*` al backend; backend como servicio del sistema | 5 | S1 |
| US-06 | Como sistema, quiero una cola de trabajos en PostgreSQL | Colas con pg-boss para envío WhatsApp, correo, recordatorios y generación de órdenes; reintentos con backoff y cola de fallidos visible | 5 | S2 |

### E2 · Identidad, acceso y sesión

| ID | Historia de usuario | Criterio de aceptación (resumido) | Pts | Sprint |
|---|---|---|---|---|
| US-07 | Como colaborador, quiero ingresar con mi correo corporativo | OAuth 2.0 con flujo de código de autorización y PKCE; la app nunca ve la contraseña; sesión en servidor | 8 | S2 |
| US-08 | Como desarrollo, quiero un spike de consulta a Esculapio | Informe: si Esculapio permite consultar empresas y sedes con cuenta técnica sin contraseña; si no, alternativa documentada | 5 | S2 |
| US-09 | Como colaborador, quiero seleccionar mi empresa y sede | Pantalla con empresas y sedes obtenidas de Esculapio; sesión con (usuario, empresa, sede activa); confirmación de ubicación habitual | 5 | S2 |
| US-10 | Como colaborador, quiero verificar mi celular y autorizar el uso de WhatsApp | Código de 6 dígitos, consentimiento versionado (Ley 1581 de 2012) y estado "celular verificado" por usuario | 5 | S2 |
| US-11 | Como sistema, quiero roles y permisos por rol, sede y nivel | 6 roles (solicitante, analista N1, técnico N2, especialista N3, coordinador, administrador); el solicitante solo ve sus tickets; filtros aplicados en la API, no solo en la UI | 8 | S2 |
| US-12 | Como administrador, quiero registrar colaboradores sin correo corporativo | Alta de número + área + sede; el usuario reporta solo por WhatsApp; estado de autorización visible | 3 | S3 |

### E3 · Catálogos y administración base

| ID | Historia de usuario | Criterio de aceptación (resumido) | Pts | Sprint |
|---|---|---|---|---|
| US-13 | Como administrador, quiero administrar los catálogos | CRUD de categorías, subcategorías, sedes, ubicaciones, equipos de referencia, prioridades, estados y niveles | 8 | S3 |
| US-14 | Como administrador, quiero sincronizar sedes y ubicaciones desde Esculapio | Importación/sincronización de sedes y ubicaciones con reporte de conflictos | 5 | S3 |
| US-15 | Como administrador, quiero parametrizar ANS y reglas de escalamiento | Matriz de primera respuesta y solución editable por prioridad; versionado de cambios | 5 | S3 |
| US-16 | Como administrador, quiero gestionar usuarios, áreas y roles | Alta/edición/baja, asignación de rol, área, sede y delegación de firma; auditoría de cambios | 5 | S4 |

### E4 · Núcleo de tickets

| ID | Historia de usuario | Criterio de aceptación (resumido) | Pts | Sprint |
|---|---|---|---|---|
| US-17 | Como sistema, quiero el modelo de ticket con numeración propia | Los 18 campos del doc; numeración `MA-0000` para correctivos y `PV-0000` para preventivos; tipo correctivo/preventivo | 5 | S3 |
| US-18 | Como solicitante, quiero registrar un caso por la web | Formulario con categoría/subcategoría, equipo, ubicación, impacto y evidencias; validaciones | 8 | S3 |
| US-19 | Como solicitante, quiero ver soluciones antes de enviar | Top de artículos publicados de la KB según la categoría; se puede enviar sin leer | 5 | S5 |
| US-20 | Como mesa, quiero la bandeja de tickets con filtros | Filtros por categoría, nivel, estado, sede y canal; incluye descartados; paginación; respeta permisos | 8 | S4 |
| US-21 | Como técnico, quiero el detalle del ticket | Datos del caso, nivel, prioridad, tiempo objetivo, historial de estados y acciones | 5 | S4 |
| US-22 | Como mesa, quiero un solo hilo de conversación | Web, WhatsApp y agente IA en el mismo hilo, en orden cronológico, con canal y autor | 8 | S4 |
| US-23 | Como solicitante, quiero adjuntar evidencias | Extensiones y tamaño permitidos, verificación de archivo y control de acceso por rol | 5 | S4 |
| US-24 | Como coordinación, quiero ver los tiempos objetivo y alertas de vencimiento | Fechas objetivo calculadas por prioridad; alerta antes de vencer a técnico y coordinación | 5 | S4 |
| US-25 | Como sistema, quiero la máquina de estados del ticket | Transiciones permitidas y bloqueadas: resolver exige solución aplicada; cerrar con acta exige firma o plazo vencido | 8 | S3 |
| US-26 | Como técnico, quiero registrar la solución y la calificación | Solución obligatoria para resolver; calificación de 1 a 5 al cierre | 5 | S5 |
| US-27 | Como solicitante, quiero confirmar la solución en casos N1 o remotos | Confirmación por WhatsApp o web; si no confirma, el caso reabre; no genera acta | 5 | S4 |

### E5 · Niveles de soporte y escalamiento

| ID | Historia de usuario | Criterio de aceptación (resumido) | Pts | Sprint |
|---|---|---|---|---|
| US-28 | Como analista, quiero escalar un ticket con motivo y acciones | El sistema no permite escalar sin motivo, acciones del nivel anterior y responsable destino; queda registro en `escalamientos` | 8 | S5 |
| US-29 | Como analista, quiero escalar directo de N1 a N3 | Permitido cuando la falla afecta un área completa; notifica a coordinación | 3 | S5 |
| US-30 | Como nivel superior, quiero devolver el ticket a un nivel inferior | Exige justificación; notifica al solicitante | 3 | S5 |
| US-31 | Como mesa, quiero ver la ruta de atención del ticket | Diagrama con niveles, responsables y tiempos objetivo | 5 | S5 |
| US-32 | Como coordinación, quiero asignar técnicos y ver su carga | Bandeja de pendientes de asignar; carga por nivel y sede; la asignación registra responsable | 8 | S5 |

### E6 · Base de conocimiento

| ID | Historia de usuario | Criterio de aceptación (resumido) | Pts | Sprint |
|---|---|---|---|---|
| US-33 | Como coordinador, quiero administrar los artículos | CRUD con código, pasos, categoría y estado borrador/publicado; solo el coordinador aprueba publicación | 5 | S5 |
| US-34 | Como solicitante, quiero buscar artículos de solución | Búsqueda por texto y categoría; sugerencia en el formulario web y en el agente IA | 5 | S6 |
| US-35 | Como coordinador, quiero medir la efectividad de los artículos | Usos, casos resueltos y reclasificaciones visibles en la ficha | 5 | S6 |
| US-36 | Como equipo, quiero cargar la base inicial de conocimiento | 20 artículos publicados de los casos más frecuentes, con pasos revisados | 3 | S6 |

### E7 · WhatsApp y agente IA (N1)

| ID | Historia de usuario | Criterio de aceptación (resumido) | Pts | Sprint |
|---|---|---|---|---|
| US-37 | Como usuario, quiero reportar por WhatsApp | Webhook de recepción con validación de firma de Meta; envío de mensajes y plantillas; estados de entrega | 8 | S6 |
| US-38 | Como sistema, quiero plantillas aprobadas y reintentos | Solo plantillas fuera de la ventana de 24 h; reintento con backoff; alerta a la mesa | 5 | S6 |
| US-39 | Como usuario, quiero que me identifiquen por mi número verificado | Vincula el número con la cuenta; si no está verificado responde con instrucciones de registro | 5 | S6 |
| US-40 | Como sistema, quiero que el agente use un conjunto cerrado de funciones | Solo puede crear ticket, consultar estado, buscar artículo y escalar; cada llamada queda registrada | 8 | S6 |
| US-41 | Como mesa, quiero que el agente clasifique el caso | Devuelve categoría, subcategoría, prioridad y confianza; confianza bajo el umbral → transferencia a humano | 8 | S7 |
| US-42 | Como usuario, quiero que el agente me guíe paso a paso | Pasos del artículo publicado, máximo 2 intentos; después escala | 8 | S7 |
| US-43 | Como usuario, quiero que el agente cree mi ticket y me dé el número | Crea el ticket con la información recogida, comunica `MA-0000` y consulta estados de tickets existentes del mismo usuario | 8 | S7 |
| US-44 | Como mesa, quiero que el agente descarte solicitudes de software | Detecta la solicitud, aplica la regla, registra el motivo, envía el mensaje de redirección y permite reabrir el descarte | 8 | S7 |
| US-45 | Como sistema, quiero proteger datos sensibles en WhatsApp | Detecta capturas o posible información clínica, advierte al usuario, no procesa el contenido y marca el caso para revisión | 8 | S7 |
| US-46 | Como sistema, quiero los límites del agente garantizados | No cierra tickets escalados, no modifica tickets de otros usuarios, no pide ni almacena contraseñas o códigos | 5 | S7 |
| US-47 | Como usuario, quiero hablar con una persona cuando lo pida | Transferencia por confianza baja o a petición del usuario; el analista recibe el contexto y asume la conversación | 8 | S8 |
| US-48 | Como analista, quiero supervisar las conversaciones del agente | Lista de conversaciones en curso con categoría, confianza, pasos aplicados y decisión; indicador de escritura; toma de conversación | 8 | S8 |
| US-49 | Como administrador, quiero configurar el agente | Umbral de confianza, máximo de intentos guiados, reglas de privacidad y plantillas; cambios auditados | 5 | S9 |

### E8 · Tiempo real y notificaciones

| ID | Historia de usuario | Criterio de aceptación (resumido) | Pts | Sprint |
|---|---|---|---|---|
| US-50 | Como mesa, quiero actualizaciones en vivo | Gateway Socket.IO con autenticación de sesión en cada conexión; soportado para más de 500 usuarios simultáneos | 8 | S8 |
| US-51 | Como mesa, quiero el centro de notificaciones | Notificaciones en vivo con estado de entrega por canal | 5 | S8 |
| US-52 | Como mesa, quiero la conversación en vivo con indicador de escritura | Mensajes sin recargar y aviso de que el otro usuario está escribiendo | 5 | S8 |
| US-53 | Como sistema, quiero la matriz de eventos y canales | Los 15 eventos con destino web / WhatsApp / correo, tabla editable y respetada por los tres canales | 8 | S9 |
| US-54 | Como sistema, quiero reintentar por correo si falla WhatsApp | Envío por correo + aviso a la mesa cuando la entrega por WhatsApp falla | 5 | S9 |
| US-55 | Como usuario, quiero no perder notificaciones si se corta la conexión | Reconexión automática y entrega de las notificaciones pendientes | 5 | S8 |

### E9 · Acta de cierre y firmas

| ID | Historia de usuario | Criterio de aceptación (resumido) | Pts | Sprint |
|---|---|---|---|---|
| US-56 | Como técnico, quiero generar el acta de cierre | Los 8 bloques de contenido del doc; numeración y versión; datos del ticket o de la orden preventiva | 8 | S9 |
| US-57 | Como coordinación, quiero el PDF sellado del acta | PDF generado en servidor con firmas, hash SHA-256, código de verificación y QR | 8 | S10 |
| US-58 | Como mesa, quiero los estados del acta y del ticket | Pendiente de firma, Cerrado con acta, Cerrado sin firma y Firma rechazada (reabre) | 5 | S10 |
| US-59 | Como solicitante, quiero firmar en el dispositivo del técnico | Código de 6 dígitos al WhatsApp verificado, válido 5 minutos; sin código no se firma; el técnico firma primero con su sesión | 8 | S10 |
| US-60 | Como solicitante, quiero firmar desde un enlace de WhatsApp | Plantilla `acta_firma`, token único, de un solo uso, vencimiento de 48 h; abre el acta sin iniciar sesión | 8 | S10 |
| US-61 | Como técnico, quiero firmar el acta con mi sesión | Firma del técnico siempre primero; no puede firmar por el solicitante | 3 | S10 |
| US-62 | Como solicitante, quiero rechazar el acta | Motivo obligatorio; el ticket se reabre y vuelve al técnico | 5 | S10 |
| US-63 | Como mesa, quiero recordatorios de firma automáticos | Avisos a las 4 h y 24 h por WhatsApp | 5 | S10 |
| US-64 | Como mesa, quiero cerrar las actas sin firma | A las 48 h sin firma pasa a Cerrado sin firma, con constancia de avisos y estados de entrega | 5 | S11 |
| US-65 | Como jefe de área, quiero registrar un delegado | Delegado registrado previamente puede firmar cuando el solicitante no está disponible | 5 | S11 |
| US-66 | Como mesa, quiero la bandeja de actas de cierre | Firmadas, pendientes, cerradas sin firma y rechazadas, con el plazo restante | 5 | S11 |
| US-67 | Como solicitante, quiero verificar que el acta no fue alterada | Página pública por código y QR que muestra autenticidad, firmas y hash; no expone datos sensibles | 8 | S10 |
| US-68 | Como coordinación, quiero actas inmutables y versionadas | El PDF sellado no se edita; una corrección genera nueva versión firmada y la anterior queda en el historial | 5 | S11 |

### E10 · Mantenimiento preventivo

| ID | Historia de usuario | Criterio de aceptación (resumido) | Pts | Sprint |
|---|---|---|---|---|
| US-69 | Como administración, quiero el inventario de equipos | Placa o serial, tipo, marca, modelo, sede, área, ubicación, responsable y estado; sin inventario no hay planes | 8 | S11 |
| US-70 | Como administración, quiero cargar el inventario en lote | Importación por CSV con validación y reporte de errores | 5 | Reserva |
| US-71 | Como administración, quiero definir planes preventivos | Tipo de equipo, frecuencia (trimestral/semestral/anual), checklist con ítems obligatorios y alcance por equipos o áreas | 8 | S11 |
| US-72 | Como sistema, quiero generar las órdenes preventivas | Se generan 15 días antes de la fecha programada (anticipación configurable) y se asignan al técnico N2 de la sede | 8 | S12 |
| US-73 | Como coordinación, quiero el calendario de preventivos | Vista mensual por sede, área, tipo de equipo y técnico, con estados de color: programado, ejecutado con acta, pendiente de firma y vencido | 8 | S12 |
| US-74 | Como técnico, quiero ejecutar la checklist en el sitio | Checklist en celular o tableta con ítems obligatorios, valores medidos y fotos; el acta solo se genera si todo está completo | 8 | S12 |
| US-75 | Como técnico, quiero reprogramar una orden | Motivo obligatorio; queda registrada y cuenta en el indicador de cumplimiento | 5 | S12 |
| US-76 | Como coordinación, quiero alertas de órdenes vencidas | La orden no ejecutada en su fecha pasa a Vencida y genera alerta | 3 | S12 |
| US-77 | Como técnico, quiero abrir un correctivo desde un preventivo | Ticket correctivo vinculado a la orden y al equipo | 5 | S12 |
| US-78 | Como administración, quiero el historial por equipo | Todos los preventivos y correctivos del equipo con sus actas, para decidir reparación o reemplazo | 5 | S12 |
| US-79 | Como coordinación, quiero medir el cumplimiento del plan | Cumplimiento = órdenes ejecutadas con acta firmada / órdenes programadas del periodo; coincide con las actas firmadas | 5 | S12 |
| US-80 | Como jefe de área, quiero aviso previo de la visita | Aviso por WhatsApp con la fecha programada antes de la visita | 3 | S11 |

### E11 · Panel, reportes y auditoría

| ID | Historia de usuario | Criterio de aceptación (resumido) | Pts | Sprint |
|---|---|---|---|---|
| US-81 | Como coordinación, quiero el panel principal | Indicadores en vivo: tickets abiertos, resueltos por IA, en N2/N3, actas pendientes de firma, cumplimiento de preventivos y próximos a vencer | 8 | S9 |
| US-82 | Como coordinación, quiero reportes de servicio | Cumplimiento de ANS, resolución por nivel, resolución por IA, satisfacción y equipos con más incidencias | 8 | S8 |
| US-83 | Como coordinación, quiero exportar los reportes | Exportación a Excel y PDF | 5 | Reserva |
| US-84 | Como coordinación, quiero el historial y la auditoría | Registro cronológico del ticket con decisiones del agente, entregas de WhatsApp y evidencia de cada firma | 8 | S9 |

### E12 · Operación, seguridad y documentación

| ID | Historia de usuario | Criterio de aceptación (resumido) | Pts | Sprint |
|---|---|---|---|---|
| US-85 | Como administrador, quiero la seguridad de integraciones y secretos | Validación de la firma de los webhooks de Meta; tokens y credenciales solo en variables de entorno | 5 | S9 |
| US-86 | Como administrador, quiero respaldos y recuperación | Copias de seguridad de PostgreSQL, plan de recuperación y verificación de restauración | 5 | S11 |
| US-87 | Como administrador, quiero administrar las plantillas de WhatsApp | Listado con contenido, idioma y estado de aprobación en Meta | 3 | S11 |
| US-88 | Como usuario, quiero las guías del sistema | Guía de usuario, guía de administración y guía de redacción de artículos de conocimiento | 5 | Reserva |
