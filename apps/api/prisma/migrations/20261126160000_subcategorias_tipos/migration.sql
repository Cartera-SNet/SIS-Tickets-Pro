-- Tipos de incidencia por categoría (incluye Otros) para el modal de nuevo ticket.
INSERT INTO subcategorias (id, categoria_id, nombre, activo, created_at, updated_at)
SELECT gen_random_uuid(), c.id, t.nombre, true, NOW(), NOW()
FROM categorias c
CROSS JOIN (
  VALUES
    ('Hardware', 'Monitor / pantalla'),
    ('Hardware', 'Teclado o mouse'),
    ('Hardware', 'PC o portátil no enciende'),
    ('Hardware', 'Equipo lento o se apaga'),
    ('Hardware', 'Otros'),
    ('Redes', 'Sin internet'),
    ('Redes', 'Wi-Fi intermitente'),
    ('Redes', 'VPN o acceso remoto'),
    ('Redes', 'Carpeta compartida'),
    ('Redes', 'Otros'),
    ('Impresión', 'No imprime'),
    ('Impresión', 'Atasco de papel'),
    ('Impresión', 'Hoja en blanco / calidad'),
    ('Impresión', 'Escáner'),
    ('Impresión', 'Otros'),
    ('Cuentas', 'No entra al correo'),
    ('Cuentas', 'Contraseña o bloqueo'),
    ('Cuentas', 'Permisos de aplicación'),
    ('Cuentas', 'Otros'),
    ('Ofimática', 'Word / Excel / PowerPoint'),
    ('Ofimática', 'PDF o visor'),
    ('Ofimática', 'Navegador / intranet'),
    ('Ofimática', 'Otros')
) AS t(categoria, nombre)
WHERE c.nombre = t.categoria
  AND c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM subcategorias s
    WHERE s.categoria_id = c.id
      AND s.nombre = t.nombre
      AND s.deleted_at IS NULL
  );
