-- Sustituye tipos genéricos por los títulos de incidencia (sin códigos KB).
-- Los códigos KB quedan solo en base de conocimiento.

UPDATE subcategorias s
SET deleted_at = NOW(), updated_at = NOW(), activo = false
FROM categorias c
WHERE s.categoria_id = c.id
  AND c.deleted_at IS NULL
  AND s.deleted_at IS NULL
  AND s.nombre IN (
    'Monitor / pantalla',
    'Teclado o mouse',
    'PC o portátil no enciende',
    'Equipo lento o se apaga',
    'Sin internet',
    'Wi-Fi intermitente',
    'VPN o acceso remoto',
    'Carpeta compartida',
    'No imprime',
    'Atasco de papel',
    'Hoja en blanco / calidad',
    'Escáner',
    'Contraseña o bloqueo',
    'Permisos de aplicación',
    'Word / Excel / PowerPoint',
    'PDF o visor',
    'Navegador / intranet'
  );

INSERT INTO subcategorias (id, categoria_id, nombre, activo, created_at, updated_at)
SELECT gen_random_uuid(), c.id, t.nombre, true, NOW(), NOW()
FROM categorias c
CROSS JOIN (
  VALUES
    ('Hardware', 'El monitor queda negro'),
    ('Hardware', 'El teclado no escribe'),
    ('Hardware', 'El mouse no se mueve'),
    ('Hardware', 'La PC no enciende'),
    ('Hardware', 'El portátil se apaga solo'),
    ('Hardware', 'Otros'),
    ('Redes', 'No hay internet en el puesto'),
    ('Redes', 'El Wi-Fi no aparece'),
    ('Redes', 'La VPN no conecta'),
    ('Redes', 'No abre la carpeta de red'),
    ('Redes', 'Otros'),
    ('Impresión', 'La impresora no imprime'),
    ('Impresión', 'Sale la hoja en blanco'),
    ('Impresión', 'La impresora está atascada'),
    ('Impresión', 'No escanea'),
    ('Impresión', 'Otros'),
    ('Cuentas', 'El usuario de Windows está bloqueado'),
    ('Cuentas', 'No entra al correo'),
    ('Cuentas', 'No abre una carpeta compartida'),
    ('Cuentas', 'Otros'),
    ('Ofimática', 'Word no abre el archivo'),
    ('Ofimática', 'Excel va muy lento'),
    ('Ofimática', 'El PDF no se ve'),
    ('Ofimática', 'El navegador no carga la intranet'),
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
