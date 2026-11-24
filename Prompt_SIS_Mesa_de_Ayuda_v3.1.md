# PROMPT MAESTRO — SIS · Sistema Web de Mesa de Ayuda TI (v3.1)

> Pega este archivo completo en Cursor (o guárdalo en el repo como `docs/PROMPT_MAESTRO.md` y referencia con `@`). Luego pide **un sprint a la vez**: «Ejecuta el Sprint N» (S1–S12, sección 16).

**De dónde sale cada cosa**

- **Comportamiento** (qué hace el sistema, pantallas, datos, reglas): este prompt, tomado de `Documentacion_SIS_Mesa_de_Ayuda_v3_1`. No lo reemplaces por el criterio de una línea de `Epicas.md`.
- **Plan de trabajo** (qué se construye en cada semana y en qué orden): `Epicas.md`, historias US-01 a US-88, sprints S1–S12 y la bolsa Reserva. El resumen de 6 semanas (`Backlog_Sprints_Mesa_de_Ayuda_SIS.md`) no sustituye este plan.
- Si el texto corto de una historia contradice este prompt, **manda este prompt**. Esas diferencias ya están anotadas en la sección 16. No reabras los 6 roles ni el login «solo OAuth corporativo».

---

## 0. Cómo debes trabajar (léelo primero)

1. Actúa como **arquitecto y desarrollador fullstack senior** (NestJS + React + PostgreSQL). Responde y comenta en **español**; el código (identificadores) puede ir en inglés o español, pero **toda la UI, estados, mensajes y errores van en español**.
2. Este documento es la fuente de verdad del **comportamiento**. `Epicas.md` es la fuente de verdad del **orden**. No inventes funcionalidades fuera de este prompt. Lo marcado **[Por definir]** NO se decide por tu cuenta: impleméntalo como **parámetro configurable** (tabla `configuracion` + pantalla de administración) con el valor por defecto indicado, y déjalo anotado en `docs/PENDIENTES.md`.
3. Trabaja **por sprints** (sección 16). Al terminar cada sprint: ejecuta tests, corre el linter, resume qué historias cerraste y cuáles quedan, y **detente** esperando mi confirmación. No avances al sprint siguiente por iniciativa propia. No implementes historias de Reserva (US-70, US-83, US-88) salvo que te lo pida.
4. Antes de escribir código en un sprint, **muestra un plan breve** (historias del sprint, archivos/módulos a crear) y si algo es ambiguo, pregunta como máximo 3 preguntas concretas.
5. **Git:** antes de subir cualquier cambio a GitHub, **pregúntame la URL del repositorio cada vez**. Commits pequeños, mensajes en español con prefijo convencional (`feat:`, `fix:`, `chore:`…).
6. **Sin Docker.** PostgreSQL se usa como servicio instalado en el equipo/servidor. El desarrollo y las pruebas se hacen primero **en mi PC local**; la guía de despliegue va al final.
7. **Integraciones externas con adaptadores:** WhatsApp Cloud API, modelo de IA, OAuth/OIDC y Esculapio deben estar detrás de **interfaces** con implementación **real** e implementación **simulada (mock)** conmutable por variable de entorno (`WHATSAPP_MODE=mock|real`, `LLM_MODE=mock|real`, `AUTH_MODE=dev|oidc`, `ESCULAPIO_MODE=mock|real`). Así todo se puede desarrollar y probar sin cuentas externas.
8. Calidad: TypeScript estricto, validación de DTOs, manejo de errores centralizado, logs estructurados, migraciones versionadas, tests unitarios en la lógica crítica (estados, ANS, escalamiento, firmas, hash) y e2e de los flujos principales. Nunca secretos en el código: todo en variables de entorno y entregar `.env.example`.
9. Datos de ejemplo (seed) **ficticios**; nunca datos reales de pacientes.
10. **Secciones «POR CONFIRMAR» (sección 20):** son borradores pendientes de revisión por otra persona del equipo. No las implementes ni las uses para decidir diseño hasta que estén marcadas como CONFIRMADO.

---

## 1. Objetivo del producto

Aplicación web **centralizada de mesa de ayuda TI** para que los colaboradores de todas las áreas reporten y consulten incidentes y solicitudes de **hardware, redes y aplicaciones básicas de cómputo**. Recibe casos por **web y WhatsApp**, resuelve en primera instancia con un **agente de IA de nivel 1**, escala a técnicos en sitio (N2) y especialistas (N3), notifica en **tiempo real**, conserva **trazabilidad completa**, cierra las intervenciones en sitio con **acta firmada por dos partes**, y gestiona el **mantenimiento preventivo** de equipos de TI.

**Canal principal = la web (requisito de diseño):** los casos se atenderán con **mayor concurrencia en la web**, porque hay áreas cuyo personal **no tiene permitido usar celular**. La web debe ser completa por sí sola (reportar, seguir el caso, chatear con el técnico, validar, calificar y firmar actas sin celular); **WhatsApp es un canal complementario**, solo para quien tenga celular autorizado y verificado. Ninguna función esencial puede depender exclusivamente de WhatsApp (ver secciones 7, 9 y 11).

**Firma presencial en el celular del técnico (opción clave):** como el solicitante puede no tener celular, **el técnico lleva su celular o tableta** y la persona firma el acta directamente en él (método A de la sección 11). Esta debe ser la **opción principal y más ágil** para cierres en sitio en las áreas sin celular: pantalla táctil, grande, que el técnico entrega y recibe sin que la persona inicie sesión en ese equipo.

**Usuarios destino (requisito de diseño):** la mesa debe estar diseñada para **personal asistencial, operativo y administrativo**. Esto implica: lenguaje claro y no técnico en la web y en WhatsApp; formularios cortos; el agente de IA adapta preguntas y tono al perfil; el personal asistencial (con poco tiempo y atención al paciente) debe poder reportar en pocos pasos por la web (o por WhatsApp si tiene celular autorizado), y sus casos que detienen un servicio asistencial se priorizan como Crítica; el personal operativo (a menudo en movimiento) debe poder usar todo desde el celular; el administrativo (PC fijo) dispone del formulario web y la bandeja completa. Cada usuario tiene un atributo `tipo_personal` (asistencial | operativo | administrativo) para segmentar reportes y ajustar la experiencia.

**Tipos de personal paramétricos (aclaración al párrafo anterior):** `tipo_personal` **no es un enum fijo en el código**: es un **catálogo administrable** (`tipos_personal`) que el Administrador puede crear, editar y desactivar desde la pantalla de catálogos. Valores iniciales (seed): *Asistencial*, *Operativo*, *Administrativo*. Cada tipo tiene atributos parametrizables: nombre, descripción, `celular_permitido` por defecto, `canal_preferido` por defecto (web | WhatsApp | correo) y, opcionalmente, una **regla de prioridad sugerida** (p. ej. servicio asistencial detenido → Crítica). El usuario referencia el tipo por FK, y el **área** puede sobrescribir `celular_permitido` (para marcar las áreas que no pueden usar celular). Reportes, notificaciones y experiencia se segmentan leyendo el catálogo, nunca valores escritos en el código.

Objetivos medibles: centralizar casos; resolver lo simple por IA; clasificar por categoría/prioridad/nivel; descartar y redirigir proyectos de software; notificar en vivo (web + WhatsApp, correo de respaldo); historial auditable; actas firmadas; preventivos con indicador de cumplimiento; medir servicio (ANS, resolución por nivel y por IA, satisfacción).

## 2. Alcance

**Se atiende** (categorías): Hardware (PC, portátiles, monitores, periféricos, UPS, lectores, cámaras, préstamo/reemplazo) · Redes y conectividad (cableado de puesto, Wi-Fi, internet, VPN, carpetas de red, puntos sin servicio) · Impresión (impresoras, escáneres, multifuncionales, colas, tóner) · Aplicaciones básicas (ofimática, correo, navegador, lector PDF, antivirus, instalación de software licenciado autorizado) · Cuentas y accesos (desbloqueo de usuario Windows, correo, permisos de carpetas) · Mantenimiento preventivo (PC, portátiles, impresoras, UPS, switches de piso, access points).

**Fuera de alcance:** mantenimiento de planta e infraestructura física (aire acondicionado, montacargas, maquinaria, instalaciones eléctricas). **No gestiona proyectos de software.**

**Regla de frontera (implementar como regla de clasificación + prompt del agente):** *se atiende todo lo que se resuelve sin modificar código; se descarta todo lo que requiere desarrollar, modificar o configurar la lógica de un sistema.*

| Caso | Decisión |
|---|---|
| «El programa X no abre en mi computador» | Se atiende (instalación, permisos o equipo) |
| «No puedo ingresar a Esculapio, usuario bloqueado» | Se atiende N1 · **[Por definir]** si el desbloqueo en Esculapio lo hace esta mesa (parámetro `desbloqueo_esculapio_en_mesa`, defecto `true`) |
| «Necesito un reporte nuevo en Esculapio» | **Descartado** (requiere desarrollo) |
| «El sistema calcula mal el valor de la factura» | **Descartado** (error de lógica de la aplicación) |
| «Queremos una aplicación para controlar inventario» | **Descartado** (proyecto de software nuevo) |
| «Instalar Office en el equipo nuevo» | Se atiende (aplicación básica licenciada) |

Los descartes: estado `Descartado`, guardan **regla aplicada** + **mensaje de redirección enviado**; el agente puede descartar automáticamente, pero la mesa los **revisa y puede reabrirlos como soporte** (error de clasificación). **[Por definir]** canal de redirección (parámetro `canal_redireccion_software`, texto editable; defecto: «Envía tu solicitud al área responsable de desarrollo de software»).

## 3. Stack y restricciones técnicas (decisiones confirmadas)

| Capa | Tecnología |
|---|---|
| Frontend | **React + Vite + TypeScript**, React Router, cliente **Socket.IO**, librería de componentes (**Ant Design**, se permite pesada) tematizada con la paleta de la sección 13. SPA; móvil **solo desde el navegador** (responsive; **sin APK, sin app nativa, sin PWA**) |
| Backend | **NestJS** sobre **Node.js LTS** con TypeScript. API REST + gateway WebSocket (`@nestjs/websockets`, **Socket.IO**). Módulos: auth, tickets, niveles/escalamiento, agente-ia, whatsapp, notificaciones, base-conocimiento, catálogos, preventivo, actas/firmas, reportes, administración |
| Base de datos | **PostgreSQL 16** (datos, sesiones). **Sin Redis.** ORM: **Prisma** con migraciones versionadas |
| Cola / tareas programadas | **pg-boss** sobre PostgreSQL: envíos WhatsApp/correo con reintentos, recordatorios de firma, cierres por vencimiento, generación de órdenes preventivas, alertas de ANS |
| Tiempo real | Socket.IO; **autenticar cada conexión con la sesión**; reconexión automática y **entrega de pendientes al reconectar**; dimensionar para **más de 500 usuarios simultáneos** (usar rooms por usuario/sede/ticket, evitar broadcast global, payloads pequeños) |
| Autenticación | Dos métodos: **login de Esculapio vía API** (empresa y sede) y **Google/Gmail con OAuth 2.0 / OIDC (código + PKCE)** para quienes no tienen usuario Esculapio; **sesión en el servidor** (cookie `HttpOnly`, `Secure`, `SameSite`), almacenada en PostgreSQL |
| Mensajería | WhatsApp Business **Cloud API (Meta)**: webhook, envío de mensajes y plantillas, estados de entrega |
| Agente IA | Modelo de lenguaje **[Por definir]** detrás de la interfaz `LlmProvider` (ver sección 7) |
| Correo | SMTP corporativo (Nodemailer), configurable |
| Actas | Firma en canvas (`signature_pad`), PDF en servidor (`pdf-lib` o `pdfmake`), hash **SHA-256**, QR de verificación |
| Archivos | Almacenamiento en disco del servidor (ruta configurable) con control de acceso, límites de tamaño/extensión y verificación |
| Despliegue | **Sin Docker.** Proxy inverso (**IIS** con URL Rewrite/ARR, o Nginx) como punto único con TLS: sirve el build de React y redirige `/api`, `/socket.io` y el webhook de WhatsApp al backend; backend como **servicio del sistema** |

**Aviso de infraestructura (déjalo documentado en la guía de despliegue):** el servidor actual es Windows Server 2012 R2 (sin soporte desde oct. 2023) y las versiones LTS actuales de Node.js no lo soportan. **Es bloqueante para producción**; la recomendación es Windows Server 2019/2022 o Linux. En desarrollo no afecta: se construye y prueba en mi PC local. El webhook de WhatsApp es **la única ruta expuesta a internet**.

Estructura sugerida (monorepo con npm/pnpm workspaces): `apps/api` (NestJS), `apps/web` (React), `packages/shared` (tipos/enums/estados compartidos), `docs/`.

## 4. Roles y permisos

Se simplifica a **3 roles**. `Epicas.md` (US-11) nombra seis figuras; no se implementan como seis roles. Los niveles de soporte (N1/N2/N3) **no son roles**: son un atributo del Técnico (`niveles_atencion`, uno o varios), porque lo que hace un analista N1 también lo hace un técnico N2. Cada usuario solo ve **sus tickets o los autorizados** por su rol/sede. El sprint S2 cierra US-11 con esta tabla, no con seis roles distintos.

| Rol | Responsabilidades |
|---|---|
| **Solicitante** (personal asistencial, operativo o administrativo) | Reportar por web/WhatsApp, aportar información, validar soluciones, calificar, firmar actas propias. Defecto: **no** reporta en nombre de otros (parámetro). Si tiene la marca `es_jefe_area`: además recibe aviso de preventivos, firma actas preventivas y **registra delegados** de su área |
| **Técnico** (con `niveles_atencion`: N1, N2 y/o N3) | **Todo el trabajo de soporte:** supervisar al agente IA y tomar conversaciones, resolver en remoto, atender en sitio, registrar acciones/solución, solicitar repuestos, escalar/devolver entre niveles, ejecutar preventivos, firmar actas, gestionar proveedores (N3) y ver los tickets de su sede/nivel. El nivel solo limita **a qué cola/escalamientos** accede y qué tickets se le asignan |
| **Administrador** (incluye al Coordinador de TI) | Asignar y supervisar tiempos, **revisar descartes**, **aprobar artículos de conocimiento**, ver reportes, y administrar usuarios, roles, catálogos, plantillas WhatsApp, parámetros del agente y configuración |

**Equivalencias con el resto de este documento:** «analista N1», «técnico N2» y «especialista N3» = usuario con rol **Técnico** y ese nivel en `niveles_atencion`; «jefe de área» = **Solicitante** con `es_jefe_area`; «coordinador de TI» = rol **Administrador**. Los especialistas/proveedores externos N3 son Técnicos con acceso limitado (parámetro: si tienen acceso al sistema, defecto `false`).

Implementa un `PermissionsGuard` basado en **permisos granulares** (capacidades como `tickets.asignar`, `descartes.revisar`, `kb.aprobar`, `actas.firmar`, `reportes.ver`, `catalogos.editar`…) agrupados en los 3 roles, más el **alcance** (sede/área/nivel). La matriz de permisos es editable solo por Administrador, de modo que si más adelante se necesita separar al Coordinador del Administrador baste con crear otro rol sin cambiar código.

## 5. Autenticación (dos métodos de ingreso en la pantalla 1)

> **Actualización:** ya existe un **login de ejemplo de Esculapio (Flask) que se conecta por API** y está incluido como referencia en `docs/referencias/login_esculapio/`, y además se ofrece el **ingreso con correo Gmail para quienes no tienen usuario de Esculapio**. Esto reemplaza el flujo anterior «OAuth corporativo + Esculapio» y resuelve el riesgo de «consultar Esculapio sin contraseña».

1. **Método A — Esculapio (usuarios con usuario de Esculapio):** flujo de **3 pasos: servidor → usuario/contraseña → empresa**. Referencia obligatoria: el repo incluye `docs/referencias/login_esculapio/` (Flask: `app.py`, `templates/login.html`); **léelo con `@` y porta su lógica a TypeScript dentro de `EsculapioClient` (NestJS)**, sin inventar endpoints. Contrato de la API de Esculapio (base `https://appsintranet.esculapiosis.com/ApiCampbell/api/Usuarios/`; URL en variable de entorno):
   - `GET obtener-servidores` → lista con `$id`, `Descripcion`, `Ip_Conexion`, `Puerto` (defecto `3306`), `Usuario`. **Cachear 5 min**; si falla, usar el último caché.
   - `GET obtener-empresas` con parámetros `IpConexion`, `BdConexion` (valor fijo `"bd"`), `PortConexion`, `Usuario`, `PasswordUsu` → lista (vacía = credenciales inválidas) con `Empresa` (código), `Nombre_Empresa` y `NombreComercial` (**= la sede**). Mapear cada fila a `{cod, nombre, sede}`.
   - Endpoints propios: `GET /api/auth/servidores`, `POST /api/auth/esculapio/conectar` (valida credenciales y devuelve empresas, **sin crear sesión**), `POST /api/auth/esculapio/login` (crea la sesión con la empresa elegida), `GET /api/auth/me`, `POST /api/auth/logout`. Sesión de **8 h**. Rate limiting: **5 intentos fallidos por IP en 10 min → bloqueo de 15 min**, con mensaje «Credenciales inválidas. N intento(s) restantes».
   - **Mejoras de seguridad obligatorias respecto al ejemplo (no copiar sus fallos):** (a) **nunca `verify=False`**: validar el certificado TLS de Esculapio (si requiere CA propia, configurarla por variable de entorno); (b) **no guardar la contraseña en la sesión** (el ejemplo la guarda en texto plano; aquí se descarta tras validar); (c) la contraseña viaja como parámetro de URL por diseño de esa API: **no registrarla jamás** (enmascarar URLs en logs, errores y trazas del cliente HTTP); (d) en el paso `login`, **no confiar en la lista de empresas que envía el cliente**: guardar la lista devuelta por `conectar` en el servidor (token de pre-autenticación de corta vida, un solo uso) y verificar que la empresa elegida pertenezca a ella; (e) el rate limiting va en **PostgreSQL** (no en memoria) y solo confía en `X-Forwarded-For` si viene del proxy propio; (f) `SECRET_KEY` sin valor por defecto, y nunca modo debug en producción.
   - Al crear la sesión se une al usuario local (`usuarios.usuario_esculapio` + servidor + empresa/sede activa); si no existe, se crea con rol Solicitante.
   - **Pruebas contra el API real y APIs actualizadas:** al desarrollar esta parte (Sprint S2, US-07 y US-08), además del mock, **prueba el flujo contra el API real de Esculapio** (`ESCULAPIO_MODE=real`). **Si las APIs fallan** (error HTTP, tiempo de espera, respuesta con formato distinto, error de certificado, etc.), **detente y avísame con el detalle del fallo** (endpoint, código, mensaje y respuesta): yo te entregaré las APIs actualizadas. **No inventes endpoints, no adivines parámetros ni desactives la validación TLS para hacerlo funcionar.** Mientras tanto sigue con `ESCULAPIO_MODE=mock` para no bloquear el resto del sprint.
2. **Método B — Gmail (usuarios sin usuario de Esculapio):** botón «Continuar con Gmail» (Google OAuth 2.0 / OIDC, código + PKCE; la app **nunca ve ni almacena la contraseña de Google**). Tras el ingreso, el usuario elige o confirma **empresa, sede y área desde el catálogo local** (no desde Esculapio). Rol por defecto: Solicitante. Como Gmail es una cuenta personal, **salvaguarda propuesta:** el primer ingreso queda en estado `Pendiente de aprobación` hasta que Administrador o Coordinador lo apruebe o lo vincule (parámetro `gmail_requiere_aprobacion`, defecto `true`).
3. **Comunes a ambos métodos:** confirmar ubicación habitual, **correo de notificaciones** y, **solo si el usuario tiene celular autorizado, verificar el celular** (código por WhatsApp) con **autorización de tratamiento de datos** (Ley 1581 de 2012). **El celular es opcional**: quien no lo tenga usa la web y el correo para todo. La sesión guarda `metodo_auth` (`esculapio` | `google`); los permisos dependen solo del rol y del alcance (sede/área), no del método.
4. **Vinculación de cuentas:** el Administrador puede **vincular una cuenta Gmail a un usuario de Esculapio** (tabla administrada) para que ambos métodos entren al mismo usuario. **[Por definir]** si habrá coincidencia automática.
5. **WhatsApp no usa este login:** el usuario se identifica por **número verificado**, registrado la primera vez que entra a la web o por un administrador (quienes no tengan ninguna de las dos cuentas reportan solo por WhatsApp).
6. **Desarrollo local:** `AUTH_MODE=dev` (selector de usuarios de prueba para ambos métodos), `ESCULAPIO_MODE=mock|real` (el mock imita exactamente las respuestas de `obtener-servidores` y `obtener-empresas` descritas arriba) y `GOOGLE_AUTH_MODE=mock|real`.

## 6. Tickets: campos, niveles, ANS, estados

### 6.1 Campos
Número (`MA-0000`; órdenes preventivas `PV-0000`; actas `AC-0000`, preventivas `AC-P-0000`) · Tipo (Correctivo | Preventivo) · Canal de origen (Web | WhatsApp) · Solicitante · Categoría/Subcategoría (validables por la mesa) · Título y descripción (el agente los redacta) · Ubicación (sede, piso, puesto; obligatoria para atención en sitio) · Equipo (placa/serial, si aplica) · Impacto (¿puede trabajar? ¿cuántas personas?) · Prioridad (calculada por reglas, ajustable por la mesa) · Nivel actual (N1/N2/N3) · Responsable · Fechas objetivo (primera respuesta y solución) · Evidencias (fotos/capturas/documentos con límites) · Solución aplicada (**obligatoria para resolver**) · Calificación 1–5 al cierre · Motivo de descarte · Acta de cierre (si aplica).

### 6.2 Niveles y escalamiento
- **N1** (agente IA + analistas remotos): diagnóstico guiado, FAQ, desbloqueo de cuentas, config. de correo/impresoras, instalación remota de software básico, creación/clasificación del ticket, descarte de software. Escala si: se agotan los pasos guiados (**máx. 2 intentos**), requiere presencia física, **confianza baja** (umbral configurable) o el usuario pide una persona.
- **N2** (técnicos en sitio): revisión física, reparación, cambio de partes, cableado de puesto, reinstalación de SO, préstamo/reemplazo. Escala a N3 si la falla es de infraestructura (switches, servidores, enlaces), requiere permisos administrativos especiales o intervención del fabricante.
- **N3** (especialistas internos/proveedores): infraestructura de red, servidores, firewall, enlaces, garantías. Sin escalamiento superior; la gestión con proveedor se registra en el ticket.

**Reglas:** todo escalamiento exige **motivo + acciones realizadas + responsable destino** (sin ellos el sistema **no** permite escalar) · N1→N3 directo si afecta a un área completa · un nivel superior puede **devolver** a uno inferior con justificación · cada cambio de nivel notifica al solicitante (web + WhatsApp) · el **agente IA nunca cierra un ticket escalado**; solo cierra lo que resolvió en N1 y el usuario confirmó.

### 6.3 Prioridad y ANS (**propuestos**, configurables en Administración; **[Por definir]** aprobación de TI)
| Prioridad | Criterio | 1.ª respuesta | Solución |
|---|---|---|---|
| Crítica | Área completa o servicio asistencial detenido | 15 min | 4 h |
| Alta | Una persona con trabajo detenido y sin alternativa | 30 min | 8 h |
| Media | Trabaja con dificultad o tiene alternativa | 2 h | 2 días hábiles |
| Baja | Consulta o solicitud programable | 1 día hábil | 5 días hábiles |

Calcular fechas objetivo con **calendario/horario hábil configurable**. **El tiempo de solución se mide hasta el estado `Resuelto`, no hasta la firma.** Alertar **antes de vencer** (web + WhatsApp al técnico y coordinación + correo a coordinación).

### 6.4 Máquina de estados (implementar con transiciones validadas en un servicio único; todos los estados visibles **en español**)
- **Correctivo:** `Nuevo → En atención N1 → Escalado → Asignado → En sitio / En proceso → (Esperando usuario | Esperando repuesto) → Resuelto`.
- **Cierre sin acta** (N1 y remotos N2/N3): `Resuelto → Cerrado` con confirmación simple por WhatsApp o web + calificación.
- **Cierre con acta** (correctivo N2/N3 con intervención en sitio): `Resuelto → Pendiente de firma → Cerrado con acta` | `Cerrado sin firma` (vence plazo) | `Firma rechazada` (**reabre** el ticket y vuelve al técnico).
- **Especiales:** `Descartado`, `Cancelado`, `Reabierto`.
- **Orden preventiva (`PV-`):** `Programada → Asignada → En ejecución → Pendiente de firma → Cerrada con acta`, más `Reprogramada` y `Vencida`.

Todo cambio de estado, nivel, responsable, mensaje y decisión del agente se registra en `historial` (inmutable, con usuario, fecha y datos previos/nuevos).

## 7. Agente de IA de nivel 1 (WhatsApp)

**Rol:** filtrar, guiar y escalar bien (no reemplazar técnicos; en hardware/redes la parte resoluble en remoto es limitada). Valor: reducir tiempo de registro, completar información y resolver lo remoto.

**Arquitectura:** interfaz `LlmProvider` (`chat(messages, tools)`) con implementaciones `mock` y `real` (**[Por definir]** proveedor/modelo; la política de datos decide nube vs. modelo propio). El agente usa un **conjunto cerrado de funciones (tools)**: `crear_ticket`, `consultar_estado_tickets_del_usuario`, `buscar_articulo_kb` (solo **publicados**), `escalar` (N2/N3), `transferir_a_analista`, `descartar_software`, `solicitar_confirmacion_y_calificacion`. Cada llamada y decisión queda registrada (`conversaciones_ia`: categoría, **confianza**, artículo usado, transferencia a humano).

**Funciones:** identificar al usuario por celular verificado y vincular su cuenta · entender el problema en lenguaje natural y pedir lo que falta (ubicación, equipo, desde cuándo, si puede trabajar) · clasificar categoría y prioridad · guiar pasos **solo con artículos publicados** · crear ticket e informar el número · consultar estado de tickets **del mismo usuario** · escalar o pasar a humano · detectar y descartar software con mensaje de redirección · pedir confirmación y calificación al cierre.

**Límites duros (validar en código, no solo en el prompt del modelo):** no ejecuta acciones remotas en equipos/servidores · **no solicita, recibe ni almacena contraseñas ni códigos de verificación** (si el usuario los envía, no se guardan y se le advierte) · no responde con información fuera de la KB (si no sabe, escala) · no cierra tickets escalados ni toca tickets de otros usuarios · bajo el umbral de confianza → transfiere a analista · límite de uso/costo del modelo (tope diario/mensual configurable).

**Flujo:** (1) usuario escribe al número empresarial → (2) webhook verifica número registrado y verificado; si no, responde con instrucciones de registro → (3) clasifica; si es software, descarta y redirige → (4) si hay artículo aplicable, guía paso a paso (máx. 2 intentos) → (5) si se resuelve: ticket «resuelto en N1» + confirmación y calificación → (6) si no: crea ticket con todo lo recogido y escala → (7) toda la conversación queda en el historial visible para la mesa.

**Privacidad:** el entorno es clínico; puede llegar información de pacientes por WhatsApp. Detectar (reglas + clasificación) contenido sensible, **advertir al usuario, no procesarlo (no enviarlo al modelo) y marcarlo para revisión**. Como medida conservadora, **las imágenes/documentos recibidos por WhatsApp se almacenan pero no se envían al modelo**. Requiere autorización expresa de tratamiento de datos (Ley 1581/2012).

**Agente en la web (propuesta):** como el agente solo atiende por WhatsApp y parte del personal no puede usar celular, ofrecer un **chat web con el mismo agente** (misma lógica, tools y límites), activable con el parámetro `agente_ia_en_web` (defecto `false`, **[Por definir]**). Mientras esté desactivado, los casos web reciben las **sugerencias de la base de conocimiento antes de enviar** y los toma un analista N1.

**Continuidad:** si falla el modelo o WhatsApp, el sistema sigue operando por web y los casos pasan a analistas humanos.

## 8. WhatsApp Business (Cloud API)

- Webhook HTTPS (GET verificación + POST mensajes) con **validación de la firma de Meta** (`X-Hub-Signature-256`) e **idempotencia** por id de mensaje.
- Envío de mensajes y **plantillas aprobadas**; fuera de la ventana de 24 h solo plantillas. Plantillas mínimas: `acta_firma`, `recordatorio_firma`, `codigo_verificacion`, ticket creado/asignado/cambio de nivel/resuelto/descartado, preventivo próximo. Tabla `plantillas_whatsapp` (nombre, contenido, idioma, estado de aprobación en Meta) y pantalla de gestión.
- Estados de entrega (enviado/entregado/leído/fallido) guardados por mensaje. **Si WhatsApp falla → reintentos con la cola y respaldo por correo**; alertar a la mesa.
- Mensajes breves y con botones. Costos: contar conversaciones facturables y alertar por consumo.
- Registro/verificación de celular con código y autorización de datos.

## 9. Notificaciones y tiempo real

Tres canales complementarios: **web en vivo** (Socket.IO: centro de notificaciones, paneles, bandejas, conversación por ticket con indicador «está escribiendo…»), **WhatsApp** (alertas al celular y conversación con el agente) y **correo** (respaldo formal / cuando falla WhatsApp o el usuario no autorizó ese canal).

**Usuarios sin celular autorizado:** la web (en vivo) y el **correo pasan a ser sus canales principales**: todo evento marcado como WhatsApp se envía por correo (si hay `correo_notificaciones`) y siempre queda en el centro de notificaciones web. El sistema decide el canal por usuario según tenga o no celular verificado.

Matriz de eventos (**propuesta, parametrizable** — **[Por definir]** definitiva):

| Evento | Web | WhatsApp | Correo |
|---|---|---|---|
| Ticket creado | Sí | Sí (solicitante) | Opcional |
| Ticket asignado | Sí | Sí (solicitante y técnico) | No |
| Cambio de nivel | Sí | Sí (solicitante) | No |
| Se requiere información del usuario | Sí | Sí (solicitante) | Sí |
| Nuevo mensaje en el ticket | Sí | Sí, si el usuario no está conectado | No |
| Tiempo objetivo por vencer | Sí | Sí (técnico y coordinación) | Sí (coordinación) |
| Ticket resuelto (validación) | Sí | Sí (solicitante) | Sí |
| Solicitud descartada | Sí | Sí (solicitante) | No |
| Acta pendiente de firma | Sí | Sí (enlace de firma) | Sí |
| Código de verificación de firma | — | Sí (2.º firmante) | No |
| Recordatorio de firma (4 h y 24 h) | Sí | Sí | No |
| Acta firmada o cerrada sin firma | Sí | Sí (ambas partes, con PDF) | Sí |
| Preventivo programado próximo | Sí | Sí (jefe del área) | Opcional |
| Orden preventiva vencida | Sí (coordinación) | No | Sí (coordinación) |
| Falla de envío por WhatsApp | Sí (mesa) | — | Reintento por correo |

**Conversación del ticket:** un **solo hilo** que unifica mensajes de web, WhatsApp y agente IA; lo que el técnico escribe en la web se reenvía al WhatsApp del solicitante. Centro de notificaciones con **estado de entrega por canal**.

## 10. Mantenimiento preventivo de equipos de TI

Cada revisión es una **orden preventiva (`PV-`)** con el mismo ciclo que un ticket (asignación, ejecución, acta, cierre) pero **tipo propio** para no mezclarse con los indicadores de correctivos.

- **Inventario de equipos (obligatorio; sin inventario no hay planes):** placa/serial, tipo, marca, modelo, sede, área, ubicación, responsable, estado. Incluir **importación desde Excel/CSV** (**[Por definir]** formato/fuente).
- **Planes preventivos:** tipo de equipo, frecuencia (trimestral/semestral/anual), **checklist con ítems obligatorios** (ítems de tipo casilla, valor medido con unidad —p. ej. temperatura CPU °C—, estado OK/FAIL, foto), equipos o áreas incluidos, anticipación de generación.
- **Órdenes automáticas:** el sistema las genera **15 días antes** de la fecha programada (parámetro **[Por definir]**) y las asigna al **técnico N2 de la sede**.
- **Calendario mensual** por sede, área, tipo de equipo y técnico, con colores de estado: programado, ejecutado con acta, pendiente de firma, vencido.
- **Ejecución (móvil/tableta, navegador):** el técnico completa la checklist, registra valores y fotos. Si encuentra una falla, **crea un ticket correctivo vinculado**. Botón «Generar acta (faltan N ítems)» **deshabilitado** hasta completar todos los obligatorios.
- **Historial por equipo:** todos los preventivos y correctivos con sus actas (para decidir reparaciones/reemplazos).
- **Reglas:** el acta solo se genera con todos los ítems obligatorios completos · si el equipo no está disponible, **reprogramar con motivo** (queda registrado y cuenta en el indicador) · orden no ejecutada en fecha → **Vencida** + alerta a coordinación · aviso por WhatsApp al jefe del área antes de la visita · **indicador de cumplimiento = órdenes ejecutadas con acta firmada / órdenes programadas del periodo**.
- **[Por definir]** (parametrizable): frecuencias por tipo, contenido de cada checklist (cargar checklists de ejemplo editables), horario laboral o fuera de él.

## 11. Acta de cierre y firmas

**Cuándo aplica**
| Caso | ¿Acta? | Firmantes |
|---|---|---|
| Correctivo N2/N3 con intervención en sitio | Sí | Técnico y solicitante |
| Mantenimiento preventivo | Sí | Técnico y jefe del área (o delegado registrado) |
| Resuelto en N1 (IA o mesa remota) | No | Confirmación simple (WhatsApp o web) |
| Correctivo N2/N3 resuelto remoto | No | Confirmación simple |

**Contenido del acta:** número, versión y número de ticket/orden · solicitante o área, sede y ubicación · equipo (placa/serial) · fechas de apertura y solución · diagnóstico, actividades, repuestos, estado final · (preventivo) checklist con resultados y valores medidos · observaciones del solicitante/jefe de área · firmas con **nombre, cargo, fecha, hora y método** · **código de verificación** (formato `7F3A-91C2`), **QR** y **hash SHA-256**. El **PDF tiene fondo blanco** (impresión), título «ACTA DE CIERRE DE SERVICIO», línea turquesa y cuadro de verificación (ver pantalla 26).

**Métodos de firma** — el **técnico firma siempre primero** con su sesión autenticada:
- **A. Presencial en el dispositivo del técnico:** el técnico entrega su celular/tableta; el solicitante revisa, marca si quedó resuelto y firma con el dedo. Se identifica con un **código de 6 dígitos enviado a su WhatsApp verificado, válido 5 minutos** (guardar solo el hash del código; límite de intentos). **Sin código no se firma.** Es la **opción prioritaria en áreas sin celular**: el dispositivo es del técnico (de la empresa), no del solicitante. Si el solicitante no tiene WhatsApp, el código llega a su **correo** (ver método C) y lo digita en el dispositivo del técnico. Nunca se pide que el solicitante escriba su contraseña de Esculapio o Google en el equipo del técnico.
- **B. Enlace por WhatsApp:** plantilla `acta_firma` al WhatsApp verificado; el enlace abre el acta **sin iniciar sesión** y permite firmar o rechazar desde el celular. **Token único, un solo uso, vence a las 48 h.**
- **C. Respaldo por correo (propuesta, para quien no tiene celular autorizado):** el código de 6 dígitos (método A, 5 min) o el enlace de un solo uso (método B, 48 h) se envían al **correo de notificaciones registrado** en lugar de WhatsApp (el solicitante lee el código en su PC y lo digita en el dispositivo del técnico, método A); también puede firmarse con la **sesión web autenticada** del solicitante desde su PC. Se guarda en la evidencia el canal usado. **[Por definir]** validación jurídica de este respaldo (la fuerza probatoria del número verificado es mayor que la del correo).

La firma dibujada por sí sola no identifica a nadie: la evidencia es la identidad autenticada/número verificado, código validado, fecha y hora, **dispositivo (user-agent/IP)** y **huella del documento**; guardarla en `firmas` y mostrarla en «Ver evidencia de firmas» y en Auditoría. **[Por definir]** validación jurídica (Ley 527/1999, Decreto 2364/2012, Decreto 1074/2015): no se plantea como firma digital certificada; documentarlo en la UI/guía.

> ⚠️ **Firma guardada del usuario:** existe una propuesta **por confirmar** (sección 20) para reutilizar la firma almacenada y cifrada. **No implementarla** hasta que esa sección esté marcada como CONFIRMADO; mientras tanto, la firma se dibuja en cada acta como aquí se describe.

**Reglas de cierre**
- Al resolver, el ticket pasa a `Pendiente de firma` y se envía el acta al 2.º firmante.
- Recordatorios automáticos por WhatsApp a las **4 h y 24 h**.
- Sin firma en **48 h** (parámetro **[Por definir]**) → `Cerrado sin firma`, dejando **constancia en el acta de los avisos enviados y su estado de entrega**.
- El firmante puede marcar **«No quedó resuelto»** con **motivo obligatorio** → el ticket se **reabre** y vuelve al técnico.
- **El técnico no puede firmar por el solicitante** ni cerrar el acta sin 2.º firmante o sin cumplirse el plazo.
- Si el solicitante no está, firma un **delegado del área registrado previamente** (los registra el jefe de área; **[Por definir]** quién delega).
- El **PDF sellado es inmutable**: una corrección genera **nueva versión** que ambas partes vuelven a firmar; la anterior queda en el historial.
- El acta se adjunta al ticket y se envía a ambos firmantes por **WhatsApp y correo**.
- **Página pública de verificación** (`/verificar`): ingresando código (o escaneando el QR) confirma la autenticidad comparando el hash; no expone datos sensibles.

## 12. Módulos y pantallas (27)

Menú lateral: Inicio · Tickets · Nuevo ticket · Agente IA (N1) · Mant. preventivo · Actas de cierre · Notificaciones · Base de conocimiento · Reportes · Configuración. Cabecera: indicador **«En vivo»** (punto verde), campana con contador, avatar + nombre + «Rol · Sede».

| # | Pantalla | Contenido clave |
|---|---|---|
| 1 | Inicio de sesión | Dos opciones: **Esculapio** (servidor + usuario + contraseña, por API) o **«Continuar con Gmail»** (sin contraseña en el sitio); indica la alternativa WhatsApp |
| 2 | Empresa y sede | Esculapio: elegir empresa/sede devueltas por la API · Gmail: elegir empresa/sede/área del catálogo local · confirmar ubicación habitual, verificar celular + autorización de datos |
| 3 | Panel principal | KPIs en vivo (abiertos, resueltos por IA hoy, en N2/N3, actas pendientes de firma, % preventivos del mes), tickets por categoría (30 días), distribución por nivel (dona con total y % resuelto por IA), descartados (software), tabla «Próximos a vencer» |
| 4 | Nuevo ticket (web) | Categoría, equipo, ubicación, impacto, evidencias; **sugerencias de KB antes de enviar**; advierte qué está fuera de alcance |
| 5 | Atención N1 por WhatsApp | Conversación del agente + panel de análisis (categoría, confianza, pasos aplicados, decisión de escalamiento); botón «tomar conversación» |
| 6 | Bandeja de tickets | Filtros: categoría, nivel, estado, sede, canal; incluye descartados; cada usuario ve solo lo autorizado |
| 7 | Detalle del ticket | Cabecera con chips (nivel, estado, prioridad, ANS «vence en…»); acciones «Escalar a N3» / «Marcar resuelto»; pestañas Información · Conversación · Evidencias · Historial; conversación en vivo unificada con «X está escribiendo…» |
| 8 | Escalamiento | Ruta de atención del ticket + formulario con motivo y acciones obligatorias |
| 9 | Gestión y asignación | Pendientes de asignar + carga de cada técnico por nivel y sede |
| 10 | Solicitud descartada | Motivo, regla aplicada, mensaje enviado; confirmar descarte o reabrir como soporte |
| 11 | Centro de notificaciones | En vivo, estado de entrega por canal, reintento por correo |
| 12 | Alertas WhatsApp (plantillas) | Vista del chat del usuario + listado de plantillas con estado de aprobación Meta |
| 13 | Base de conocimiento N1 | Artículos (código `KB-0xx`, título, categoría, pasos, borrador/publicado, usos, efectividad); aprobación por coordinador |
| 14 | Config. agente IA y WhatsApp | Parámetros de canal, umbral de confianza, intentos guiados (2), reglas de privacidad, topes de uso |
| 15 | Niveles de soporte y ANS | Definición de niveles, criterios de escalamiento, tiempos por prioridad |
| 16 | Reportes | Resolución por IA, cumplimiento de tiempos, satisfacción, tickets por nivel, equipos con más incidencias; **exportar a Excel y PDF** |
| 17 | Usuarios, áreas y roles | Vincula correo OAuth + usuario Esculapio + celular WhatsApp |
| 18 | Catálogos | Categorías, equipos de referencia, sedes (sincronizadas desde Esculapio), **tipos de personal** y áreas con la marca «celular no permitido» |
| 19 | Historial y auditoría | Línea de tiempo: decisiones del agente, entrega de WhatsApp, evidencia de cada firma |
| 20 | Validación y cierre (N1, sin acta) | Solicitante confirma o reabre y califica 1–5 |
| 21 | Calendario preventivo | Vista mensual + indicadores de cumplimiento |
| 22 | Planes preventivos e inventario | Planes por tipo, frecuencia, nº de equipos, próxima ejecución, checklist |
| 23 | Ejecución del preventivo (móvil) | Checklist, valores medidos, fotos, observaciones, historial del equipo, «Generar acta» |
| 24 | Acta en dispositivo del técnico | Método A: firma del técnico → entrega → firma del solicitante + código |
| 25 | Firma por enlace WhatsApp | Método B: firmar o rechazar desde el celular |
| 26 | Acta en PDF | Documento sellado, firmas, código, QR, huella; acciones: Descargar PDF, Ver ticket, Ver evidencia de firmas |
| 27 | Bandeja de actas | Firmadas, pendientes, cerradas sin firma, rechazadas, con **plazo restante** |

## 13. Diseño visual (tema oscuro, fiel a las pantallas de referencia)

Estilo «Mantenimiento Pro»: **fondos azul noche, tarjetas con bordes suaves, acentos turquesa y verde, estados en ámbar y rojo.** Tipografía **Inter**. Logo: cuadrado redondeado con «S» (degradado turquesa→verde) + «SIS» y subtítulo «MESA DE AYUDA TI».

Tokens (usar como variables CSS y como `theme.token` de Ant Design):
```
--bg-app:#0b141c;  --bg-sidebar:#0e1821;  --bg-card:#182633;  --bg-card-2:#121e29;  --border:#1e3040;
--primary:#14a3a3; --primary-bright:#2ec4c4; --brand-green:#19a082; --success:#3ccf8e; --success-btn:#1e9e6a;
--warning:#e0a100; --warning-bg:#45360f; --danger:#e0413c; --danger-strong:#c9302c;
--info:#7fb2ff; --info-bg:#16304f; --ai:#7b52d1; --ai-bg:#2f2350;
--text:#e6eef5; --text-muted:#8ea3b5;
```
Reglas: tarjetas KPI con **barra de acento izquierda** de color (turquesa, morado, ámbar, azul, verde); niveles como chips: **N1 turquesa, N2 ámbar, N3 rojo**; chip «Agente IA» morado; prioridad Alta en rojo; botón primario turquesa, acción positiva («Marcar resuelto») verde, secundario con borde. Ítem activo del menú con fondo `--bg-card` y borde izquierdo turquesa. **Todos los estados en español.** NO adoptar del frontend de referencia: etiqueta «SignalR», estados en inglés, textos con errores, indicadores sin unidad, ni el alcance de mantenimiento de planta. El **PDF del acta es el único fondo blanco**. Responsive real para móvil (formularios cortos; ejecución de preventivo y firmas pensadas primero para pantalla pequeña). Accesibilidad: contraste AA, foco visible, etiquetas en formularios.

## 14. Modelo de datos (PostgreSQL 16, Prisma)

Tablas: `usuarios` (id, correo_google [nulo si solo Esculapio], usuario_esculapio [nulo si solo Gmail], estado_aprobacion,  nombre, celular [opcional], celular_verificado, correo_notificaciones, autorizacion_whatsapp, rol [Solicitante|Técnico|Administrador], niveles_atencion [N1/N2/N3, solo Técnico], es_jefe_area, tipo_personal_id [FK al catálogo `tipos_personal`], area, sede, activo) · `roles_permisos` (3 roles + permisos granulares) · `catalogos` (tipos de personal [`tipos_personal`: nombre, descripción, celular_permitido, canal_preferido, regla de prioridad sugerida, activo], categorías, subcategorías, sedes, ubicaciones, prioridades, estados, niveles) · `equipos` · `tickets` (todos los campos de 6.1 + tipo, fechas de creación/resolución/cierre) · `escalamientos` (ticket, nivel origen/destino, motivo, acciones, usuario, fecha) · `mensajes` (ticket, autor [usuario|técnico|agente IA], canal, contenido, adjunto, estado de entrega, fecha) · `conversaciones_ia` (celular, usuario, ticket, decisiones, confianza, artículo, transferencia) · `base_conocimiento` (código, título, categoría, pasos, estado, usos, efectividad) · `plantillas_whatsapp` · `planes_preventivos` · `ordenes_preventivas` (plan, equipo, fecha programada, técnico, estado, resultados de checklist, reprogramaciones) · `actas` (número, versión, ticket u orden, contenido, estado, PDF, hash, código de verificación) · `firmas` (acta, firmante, rol, método, imagen, fecha/hora, número verificado, dispositivo, resultado [firmó|rechazó + motivo]) · `adjuntos` · `historial` · `notificaciones` (+ entregas por canal) · `configuracion` (clave/valor tipada).
Tablas de apoyo que debes añadir: `delegados_area`, `codigos_firma` (hash, expiración, intentos), `tokens_firma` (un solo uso, vencimiento), `sesiones`, `lecturas_notificacion`. Índices en: número de ticket, estado, nivel, sede, responsable, fechas objetivo, celular. Soft-delete donde aplique; **historial y actas sin borrado**.

## 15. Requisitos no funcionales

Seguridad (OAuth+PKCE, permisos por rol, validación de firma de webhooks, secretos en variables de entorno, rate limiting, cabeceras de seguridad, CSRF en sesión) · Privacidad (alcance por usuario, sin datos clínicos, autorización Ley 1581) · Trazabilidad total · Disponibilidad degradada (sin WhatsApp o IA el sistema opera por web y casos pasan a humanos) · Tiempo real con reconexión y pendientes · **>500 usuarios simultáneos, conectados sobre todo por la web** (paginación en listados, índices, caché de catálogos, payloads de socket pequeños; prueba de carga con k6/Artillery sobre Socket.IO) · Costos controlados (topes del modelo, monitoreo de conversaciones facturables) · Usabilidad (formularios cortos, lenguaje no técnico, WhatsApp breve con botones, pantallas pequeñas; apta para personal asistencial, operativo y administrativo) · Adjuntos (extensiones y tamaño restringidos, verificación, control de acceso) · Integridad de actas (hash en BD, PDF inmutable) · Continuidad (script de respaldo de PostgreSQL + plan de recuperación).

## 16. Plan por sprints (ejecuta SOLO el que te pidan)

El corte y el orden salen de `Epicas.md`. El detalle de cada historia está en las secciones de este prompt, no en el criterio resumido de la épica. Las fases 0 a 7 anteriores quedan absorbidas así: fundaciones en S1; acceso en S2; catálogos y ticket en S3–S5; cola en S2 y tiempo real en S8–S9; WhatsApp y agente en S6–S8; actas en S9–S11; preventivo en S11–S12; reportes de servicio en S8 y panel en S9. Importación CSV, exportación y guías siguen en Reserva.

**La documentación manda sobre estas historias**

| Historia | El texto de la épica | Se implementa así |
|---|---|---|
| US-07 | OAuth corporativo y la app nunca ve la contraseña | Sección 5: Esculapio por API (servidor → usuario/contraseña → empresa) y Gmail con OAuth 2.0 + PKCE. La contraseña de Esculapio no se guarda; la de Google nunca llega a la app |
| US-08 | Spike para consultar Esculapio sin contraseña | No queda abierto. Se porta `Login.zip` (`login_esculapio/`) a `EsculapioClient`. Si el API real falla, se detiene y se piden los contratos actualizados |
| US-11 | Seis roles: solicitante, analista N1, técnico N2, especialista N3, coordinador, administrador | Sección 4: tres roles. N1/N2/N3 son `niveles_atencion` del Técnico. Coordinador = Administrador. Jefe de área = Solicitante con `es_jefe_area` |
| US-05 | Proxy con TLS en S1, sobre el servidor actual | S1 deja el diseño (IIS o Nginx, rutas `/api`, `/socket.io`, `/webhook/*`, backend como servicio) y `.env.example`. No se despliega en Windows Server 2012 R2: sigue siendo bloqueante para producción (sección 3) |
| US-22 frente a US-50 | El hilo único está en S4 y el gateway en vivo en S8 | En S4 el hilo se guarda y se lee al abrir el ticket. Socket.IO, «está escribiendo…» y la reconexión entran en S8 (US-50, US-52, US-55). No adelantes el gateway |
| US-70, US-83, US-88 | Reserva | No entran en S1–S12. Sin importación CSV en el inventario, sin exportar reportes a Excel/PDF y sin las tres guías, hasta que se pidan |

### S1 · Fundamentos de plataforma (E1) — 31 pts

US-01 (8), US-02 (5), US-03 (8), US-04 (5), US-05 (5).

Monorepo `apps/api`, `apps/web`, `packages/shared`. Prisma y la migración inicial con las tablas de la sección 14. NestJS con los módulos de la sección 3 y `GET /health`. React Router, cliente HTTP autenticado, tema de la sección 13 y layout (sidebar, cabecera «En vivo»), adaptable a móvil. Adaptadores mock/real, módulo `configuracion`, `.env.example`, seed ficticio, README de arranque local y `docs/PENDIENTES.md`. Pipeline de build, lint, test, migrate y deploy a staging. US-05 según la tabla de arriba.

### S2 · Identidad, acceso y cola (E1 + E2) — 36 pts

US-06 (5), US-07 (8), US-08 (5), US-09 (5), US-10 (5), US-11 (8).

pg-boss para WhatsApp, correo, recordatorios y órdenes, con reintentos y cola de fallidos visible. Pantallas 1 y 2. Login de la sección 5 (US-07 y US-08 según la tabla). Sesión de servidor con usuario, empresa y sede activa. Verificación de celular y consentimiento Ley 1581 solo si hay celular autorizado. Roles y permisos de la sección 4, filtrados en la API.

### S3 · Catálogos y arranque del ticket (E2 + E3 + E4) — 42 pts

US-12 (3), US-13 (8), US-14 (5), US-15 (5), US-17 (5), US-18 (8), US-25 (8).

Alta de colaborador sin correo corporativo, que reporta solo por WhatsApp. CRUD de catálogos (pantalla 18), incluidos `tipos_personal`. Sincronización de sedes y ubicaciones desde Esculapio, con reporte de conflictos. ANS de la sección 6.3, editables y versionados (pantalla 15). Ticket con los campos de la sección 6.1 y numeración `MA-0000` / `PV-0000`. Formulario web (pantalla 4) sin obligar aún las sugerencias de KB (eso es US-19, en S5). Máquina de estados de la sección 6.4 en un solo servicio.

### S4 · Bandeja, hilo y confirmación (E3 + E4) — 41 pts

US-16 (5), US-20 (8), US-21 (5), US-22 (8), US-23 (5), US-24 (5), US-27 (5).

Pantalla 17: usuarios, áreas, roles, delegación de firma y auditoría. Bandeja (pantalla 6) con filtros, descartados, paginación y permisos. Detalle (pantalla 7) con historial. Un solo hilo cronológico (web, WhatsApp y agente) persistido; el vivo llega en S8. Adjuntos con extensión, tamaño y acceso por rol. Fechas objetivo y alerta antes de vencer. Confirmación de solución en N1 o remoto, sin acta; si no confirma, el caso se reabre.

### S5 · Escalamiento y conocimiento (E4 + E5 + E6) — 42 pts

US-19 (5), US-26 (5), US-28 (8), US-29 (3), US-30 (3), US-31 (5), US-32 (8), US-33 (5).

Sugerencias de artículos publicados antes de enviar el formulario. Solución obligatoria para resolver y calificación 1 a 5. Escalamiento (pantalla 8) con motivo, acciones y responsable; N1→N3 si el área completa está afectada; devolución con justificación. Ruta de atención. Asignación y carga (pantalla 9). CRUD de artículos en borrador/publicado; solo Administrador (coordinador) aprueba.

### S6 · WhatsApp y herramientas del agente (E6 + E7) — 39 pts

US-34 (5), US-35 (5), US-36 (3), US-37 (8), US-38 (5), US-39 (5), US-40 (8).

Búsqueda de artículos y métricas de efectividad. Cargar al menos 20 artículos publicados de ejemplo. Webhook de Meta con firma e idempotencia, envío y estados de entrega (secciones 7 y 8). Plantillas fuera de la ventana de 24 h, reintento con la cola de S2 y alerta a la mesa. Identificación por celular verificado. Conjunto cerrado de funciones del agente; cada llamada queda en `conversaciones_ia`.

### S7 · Comportamiento del agente (E7) — 45 pts

US-41 (8), US-42 (8), US-43 (8), US-44 (8), US-45 (8), US-46 (5).

Clasificación con umbral de confianza. Guía de máximo 2 intentos, solo con artículos publicados. Creación del ticket y consulta de estados del mismo usuario. Descarte de software (pantalla 10) con reapertura por la mesa. Privacidad clínica: no enviar imágenes ni contenido sensible al modelo. Límites duros de la sección 7 validados en código.

### S8 · Supervisión, tiempo real y reportes (E7 + E8 + E11) — 47 pts

US-47 (8), US-48 (8), US-50 (8), US-51 (5), US-52 (5), US-55 (5), US-82 (8).

Transferencia a un analista y toma de la conversación (pantalla 5). Socket.IO autenticado, rooms, sin broadcast global, pensado para más de 500 usuarios. Centro de notificaciones (pantalla 11). Indicador de escritura. Reconexión y entrega de pendientes. Reportes de servicio (pantalla 16) sin exportación: la exportación es US-83 y está en Reserva.

### S9 · Matriz de avisos, acta y panel (E7 + E8 + E9 + E11 + E12) — 47 pts

US-49 (5), US-53 (8), US-54 (5), US-56 (8), US-81 (8), US-84 (8), US-85 (5).

Parámetros del agente auditados (pantalla 14). Matriz de la sección 9, editable, respetada por web, WhatsApp y correo. Si falla WhatsApp, correo más aviso a la mesa; quien no tiene celular recibe por web y correo. Generación del acta con los 8 bloques, numeración y versión (aún sin el PDF sellado). Panel (pantalla 3). Auditoría (pantalla 19). Firma de webhooks y secretos solo en variables de entorno.

### S10 · PDF y firma (E9) — 50 pts

US-57 (8), US-58 (5), US-59 (8), US-60 (8), US-61 (3), US-62 (5), US-63 (5), US-67 (8).

PDF en servidor, fondo blanco, hash SHA-256, código y QR (pantallas 24, 25 y 26). Estados del acta de la sección 11. Método A (código de 6 dígitos, 5 minutos, técnico firma primero) y método B (token de un solo uso, 48 h). Rechazo con motivo, que reabre el ticket. Recordatorios a las 4 h y 24 h. Página pública `/verificar` sin datos sensibles. La sección 20 no se implementa.

### S11 · Cierre sin firma, inventario y operación (E9 + E10 + E12) — 47 pts

US-64 (5), US-65 (5), US-66 (5), US-68 (5), US-69 (8), US-71 (8), US-80 (3), US-86 (5), US-87 (3).

A las 48 h sin firma: Cerrado sin firma, con constancia de avisos. Delegado de área registrado por el jefe. Bandeja de actas (pantalla 27). PDF inmutable; una corrección es una versión nueva. Inventario obligatorio (pantalla 22) sin la importación CSV (US-70, Reserva). Planes con checklist. Aviso al jefe de área antes de la visita. Respaldo de PostgreSQL y verificación de restauración. Administración de plantillas WhatsApp (pantalla 12).

### S12 · Órdenes preventivas (E10) — 47 pts

US-72 (8), US-73 (8), US-74 (8), US-75 (5), US-76 (3), US-77 (5), US-78 (5), US-79 (5).

Generación 15 días antes, asignada al técnico N2 de la sede. Calendario (pantalla 21). Ejecución en el navegador del celular o la tableta (pantalla 23); el acta solo si el checklist obligatorio está completo. Reprogramación con motivo. Orden vencida y alerta. Correctivo vinculado a la orden y al equipo. Historial por equipo. Cumplimiento = órdenes con acta firmada / órdenes programadas del periodo.

### Reserva — no construir con S1–S12

US-70 (5) importación CSV del inventario. US-83 (5) exportación de reportes a Excel y PDF. US-88 (5) guías de usuario, de administración y de redacción de artículos.

## 17. Criterios de aceptación (checklist final)

1. Un usuario reporta por WhatsApp y recibe un número de ticket sin intervención humana.
2. Un usuario entra con su usuario de Esculapio (elige empresa/sede) o con Gmail (si no tiene Esculapio) y registra un ticket web.
3. El agente clasifica la categoría con el % acordado en el piloto **[Por definir]**.
4. El agente descarta software y envía la redirección; la mesa puede reabrir un descarte erróneo.
5. Todo ticket tiene nivel N1/N2/N3 y cada escalamiento registra motivo y acciones.
6. Notificaciones en vivo y por WhatsApp según la matriz; si WhatsApp falla, llegan por correo.
7. El hilo del ticket muestra en uno solo los mensajes de web, WhatsApp y agente.
8. Se calculan y muestran tiempos objetivo, con alerta antes del vencimiento.
9. Cada usuario accede solo a los datos autorizados para su rol.
10. El sistema opera si fallan el modelo de IA o WhatsApp.
11. Las conexiones en vivo son estables con >500 usuarios simultáneos.
12. Un correctivo N2/N3 en sitio no se cierra con acta sin firma del técnico y del solicitante, ni sin cumplirse el plazo de cierre sin firma.
13. La firma presencial exige el código enviado al WhatsApp verificado del solicitante.
14. El enlace de firma es de un solo uso y deja de funcionar al vencer.
15. El PDF del acta incluye código de verificación y su autenticidad es comprobable.
16. Un firmante puede rechazar el acta con motivo y el ticket se reabre.
17. Las órdenes preventivas se generan solas según los planes y aparecen en el calendario.
18. El indicador de cumplimiento del preventivo coincide con las actas firmadas del periodo.
19. Un usuario **sin celular autorizado** puede reportar, chatear, recibir notificaciones (web y correo), validar, calificar y firmar actas usando solo la web y el correo.

## 18. Pendientes → parámetros por defecto (registrar en `docs/PENDIENTES.md`)

áreas sin permiso de celular (listado) · chat web con el agente IA (`agente_ia_en_web`) · firma de actas por correo/sesión web (validación jurídica) · Canal de redirección de software · desbloqueo Esculapio en mesa · software «básico» autorizado · modelo/proveedor de IA y presupuesto · número empresarial de WhatsApp · horario de analistas humanos · responsable de redactar/aprobar KB · confirmar con el responsable de Esculapio el uso del API (parámetros en URL, certificado TLS válido) · aprobación de usuarios Gmail (defecto: requerida) · vínculo Gmail↔Esculapio · colaboradores sin Esculapio ni Gmail (solo WhatsApp) · técnicos por nivel/sede · aprobación de ANS · proveedores N3 · plazo de cierre sin firma (48 h) · delegados de firma · validación jurídica de la firma electrónica · copia impresa del acta · inventario inicial (fuente/formato) · frecuencias y checklists · horario de preventivos · migración del servidor y exposición HTTPS del webhook · % de acierto del agente en el piloto · matriz definitiva de notificaciones.

## 19. Formato de tus respuestas

Al iniciar un sprint: **plan breve (historias US de ese sprint)** → **código** → **cómo ejecutarlo/probarlo en local** → **resumen de lo hecho / pendientes / decisiones tomadas** → **pregunta de confirmación** (y la URL de GitHub antes de subir). Sé conciso; no repitas este documento.

---

## 20. ⚠️ POR CONFIRMAR — Firma guardada del usuario (NO implementar hasta que esté confirmada)

> **Estado: borrador pendiente de revisión.** Un compañero de trabajo revisará este apartado y agregará detalles y su punto de vista antes de ejecutar el prompt. Cursor: **no implementes nada de esta sección** (ni siquiera «por adelantado»); en los sprints S10 y S11 usa el flujo normal de la sección 11 (firma dibujada en cada acta) hasta que este apartado quede marcado como **CONFIRMADO**. Cuando se confirme, sustituye lo que corresponda en la sección 11.

### 20.1 Requisitos propuestos por el usuario
1. **Firma reutilizable:** la **primera firma** que capture un usuario se **almacena**. En las solicitudes siguientes, el usuario solo pulsa **«Finalizar»** y el acta se firma automáticamente con su firma almacenada (sin volver a dibujarla).
2. **Nombre con el que se guarda la firma:** se guarda con las **siglas del nombre y apellido** del usuario (p. ej. «Sergio Blanco» → `SB`). Si ya existe otra firma con el mismo nombre/siglas, se agrega **el nombre de la persona y la primera letra de su nombre y apellido** para distinguirla.
3. **Cifrado:** las firmas de los usuarios se **cifran** para que no queden expuestas.

### 20.2 Interpretación y diseño sugerido (a validar con el revisor)
- **Nombre de la firma (punto 2):** el texto original es ambiguo; interpretación adoptada: etiqueta = **siglas** (`SB`); si hay repetida → **nombre completo + siglas** (`Sergio Blanco · SB`). **Pregunta abierta:** ¿la etiqueta es solo visual? En base de datos la firma se enlaza siempre por `usuario_id` (único), nunca por la sigla.
- **Cifrado (punto 3):** **AES-256-GCM** con IV aleatorio por registro; la clave maestra **fuera de la base de datos** (variable de entorno o almacén de secretos), con **rotación** posible y campo `version_clave`. Guardar solo la imagen cifrada (`bytea`) + metadatos. **Descifrar únicamente en el servidor, en memoria, al generar el PDF**; la firma almacenada **nunca se envía al navegador** (ni a otros usuarios ni a administradores) ni se expone por API. En backups queda cifrada.
- **Tabla propuesta `firmas_guardadas`:** `usuario_id` (único), `etiqueta`, `imagen_cifrada`, `iv`, `version_clave`, `hash_imagen`, `fecha_captura`, `fecha_ultimo_uso`, `activa`, `autorizacion_tratamiento` (fecha del consentimiento).
- **Captura:** la primera vez se dibuja en canvas (`signature_pad`) con **consentimiento expreso** de almacenamiento (la firma es un dato personal; Ley 1581/2012). El usuario puede **reemplazarla o eliminarla** desde su perfil; el cambio queda en auditoría.
- **Uso automático:** al pulsar «Finalizar», el sistema inserta la firma guardada en el acta y registra en `firmas` la misma evidencia de la sección 11 (nombre, cargo, fecha, hora, método, dispositivo, canal, hash del documento) **y que se usó firma almacenada**.

### 20.3 Riesgos y puntos que el revisor debe decidir
1. **Valor probatorio:** la sección 11 establece que *la firma dibujada por sí sola no identifica a nadie*. Con «Finalizar» en un solo clic, cualquiera con acceso a la sesión o al dispositivo podría firmar. **Recomendación (a confirmar):** mantener un **factor de identidad en cada firma automática**, p. ej. sesión web autenticada reciente o el **código de 6 dígitos (WhatsApp o correo)**, y que «Finalizar» solo aplique la firma almacenada **después** de validarlo. Decidir si «solo pulsar Finalizar» es suficiente, **sobre todo para el solicitante**, y cómo aplica cuando firma **en el celular del técnico** (método A), donde el solicitante no usa su propia sesión.
2. **Firma del técnico vs. solicitante/jefe de área:** ¿aplica a ambos o solo al técnico? (el técnico ya firma con su sesión autenticada; el solicitante/jefe de área es donde el riesgo 1 es mayor).
3. **Quién puede firmar por otro:** se mantiene la regla de que el técnico **no puede firmar por el solicitante**; la firma almacenada solo se aplica a su dueño autenticado. Delegados de área: ¿usan su propia firma almacenada?
4. **Firma rechazada / nuevas versiones del acta:** ¿se reaplica automáticamente la firma almacenada al regenerar la versión 2, o se exige nueva confirmación?
5. **Validación jurídica** del mecanismo (Ley 527/1999, Decreto 2364/2012, Decreto 1074/2015) con el almacenamiento y reutilización de la imagen de firma.
6. **Visibilidad:** la firma se ve inevitablemente dentro del PDF sellado; definir quién puede descargar actas y por cuánto tiempo.
7. **Gestión de la clave de cifrado:** responsable, custodia, rotación y plan de recuperación (si se pierde la clave, las firmas guardadas no se pueden recuperar y deben recapturarse).
8. **Retención y baja:** qué pasa con la firma almacenada si el usuario se desactiva o sale de la empresa.

### 20.4 Observaciones del revisor (completar antes de ejecutar)
- (espacio para los comentarios y detalles adicionales del compañero)
-
-

### 20.5 Criterios de aceptación (solo cuando esté CONFIRMADO)
1. La primera firma capturada queda guardada y cifrada; en las siguientes solicitudes el usuario finaliza sin volver a dibujarla.
2. La etiqueta de la firma usa siglas y se distingue si hay repetidas.
3. La imagen de la firma no aparece en texto plano en la base de datos, en backups, en logs ni en respuestas de la API.
4. Cada uso de firma almacenada queda en la evidencia y en la auditoría.
5. El usuario puede reemplazar o eliminar su firma almacenada.
