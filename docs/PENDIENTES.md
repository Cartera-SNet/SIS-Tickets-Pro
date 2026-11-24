# Pendientes de la documentación v3.1

Lo marcado como **[Por definir]** queda en la tabla `configuracion` con el valor por defecto de abajo. No se decide en código.

| Clave | Defecto en el seed | Nota |
|---|---|---|
| `agente_ia_en_web` | `false` | Chat web con el mismo agente. |
| `desbloqueo_esculapio_en_mesa` | `true` | Si esta mesa desbloquea usuarios de Esculapio. |
| `gmail_requiere_aprobacion` | `true` | El primer ingreso con Gmail queda pendiente. |
| `canal_redireccion_software` | texto del prompt | Editable. |
| `plazo_cierre_sin_firma_horas` | `48` | Pendiente de aprobación. |
| `anticipacion_ordenes_dias` | `15` | Generación de órdenes preventivas. |
| `max_intentos_guiados` | `2` | Tope del agente. |
| `umbral_confianza_agente` | `0.7` | Propuesto. El porcentaje del piloto no está cerrado. |

## Sin valor cerrado

- Áreas sin permiso de celular (el área de ejemplo «Consulta externa» nace con celular no permitido).
- Firma de actas por correo o sesión web: validación jurídica. El método queda en el modelo; no se usa hasta el sprint de actas.
- Software «básico» autorizado.
- Proveedor, modelo y presupuesto de IA. El adaptador real espera una API de chat completions (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`).
- Número empresarial de WhatsApp.
- Horario de analistas humanos y horario hábil para calcular ANS.
- Responsable de redactar y aprobar la base de conocimiento.
- Las URLs de Esculapio entregadas (`obtener-ApiServidores`, `obtener-ApiUsuariosxEmpresas`, `authtoken/tokenjwt`) son de MySQL. Las de conexión a PostgreSQL todavía no existen. El sprint 2 se prueba con `ESCULAPIO_MODE=mock` y PostgreSQL local. No se cambia el cliente real a esas URLs.
- Vínculo automático Gmail y Esculapio.
- Colaboradores sin ninguna de las dos cuentas (solo WhatsApp).
- Técnicos por nivel y sede.
- Aprobación de los ANS. Los cuatro valores propuestos ya están en `prioridades`.
- Proveedores N3 y si entran al sistema (defecto: no).
- Quién registra delegados de firma.
- Validación jurídica de la firma electrónica (Ley 527/1999 y decretos citados).
- Copia impresa del acta.
- Inventario inicial: fuente y formato. La importación CSV es US-70 y está en reserva.
- Frecuencias y checklists definitivos.
- Horario de los preventivos.
- Migración del servidor y exposición HTTPS del webhook. Windows Server 2012 R2 no sirve para producción.
- Matriz definitiva de notificaciones (la propuesta de la sección 9 se respeta hasta que cambie).
- Sección 20, firma guardada y reutilizable: no se implementa hasta que esté CONFIRMADO.

## Decisiones ya tomadas en el prompt

- Tres roles, no seis. N1, N2 y N3 son niveles del técnico.
- Login de Esculapio por API y Gmail con OAuth + PKCE. El spike «consultar sin contraseña» no sigue abierto.
- El hilo del ticket se guarda en el sprint 4. Socket.IO entra en el sprint 8.
- US-70, US-83 y US-88 no entran en los doce sprints.
