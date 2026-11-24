import { config as cargarEnv } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient, type UnidadTiempo } from '@prisma/client';
import { ESTADO_ORDEN, ESTADO_TICKET, PERMISOS_POR_ROL, type Rol } from '@sis/shared';

cargarEnv({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

const IDS = {
  asistencial: '10000000-0000-4000-8000-000000000001',
  operativo: '10000000-0000-4000-8000-000000000002',
  administrativo: '10000000-0000-4000-8000-000000000003',
  sede: '20000000-0000-4000-8000-000000000001',
  area: '30000000-0000-4000-8000-000000000001',
  ubicacion: '40000000-0000-4000-8000-000000000001',
  ana: '50000000-0000-4000-8000-000000000001',
  luis: '50000000-0000-4000-8000-000000000002',
  marta: '50000000-0000-4000-8000-000000000003',
  categoria: '60000000-0000-4000-8000-000000000001',
  equipo: '70000000-0000-4000-8000-000000000001',
};

async function main(): Promise<void> {
  await prisma.tipoPersonal.upsert({
    where: { id: IDS.asistencial },
    update: {},
    create: {
      id: IDS.asistencial,
      nombre: 'Asistencial',
      descripcion: 'Personal de atención. Puede reportar en pocos pasos.',
      celularPermitido: false,
      canalPreferido: 'WEB',
      reglaPrioridadSugerida: 'servicio asistencial detenido → Crítica',
    },
  });
  await prisma.tipoPersonal.upsert({
    where: { id: IDS.operativo },
    update: {},
    create: {
      id: IDS.operativo,
      nombre: 'Operativo',
      descripcion: 'Personal en movimiento. Puede usar el celular autorizado.',
      celularPermitido: true,
      canalPreferido: 'WHATSAPP',
    },
  });
  await prisma.tipoPersonal.upsert({
    where: { id: IDS.administrativo },
    update: {},
    create: {
      id: IDS.administrativo,
      nombre: 'Administrativo',
      descripcion: 'Personal de escritorio. Usa la web.',
      celularPermitido: true,
      canalPreferido: 'WEB',
    },
  });

  await prisma.sede.upsert({
    where: { id: IDS.sede },
    update: {},
    create: { id: IDS.sede, codigo: 'NORTE', nombre: 'Sede Norte', codigoEsculapio: '01' },
  });
  await prisma.area.upsert({
    where: { id: IDS.area },
    update: {},
    create: {
      id: IDS.area,
      nombre: 'Consulta externa',
      sedeId: IDS.sede,
      celularPermitido: false,
    },
  });
  await prisma.ubicacion.upsert({
    where: { id: IDS.ubicacion },
    update: {},
    create: { id: IDS.ubicacion, sedeId: IDS.sede, nombre: 'Puesto 12', piso: '1', puesto: '12' },
  });

  await prisma.categoria.upsert({
    where: { id: IDS.categoria },
    update: {},
    create: { id: IDS.categoria, nombre: 'Hardware' },
  });

  const prioridades: {
    codigo: string;
    nombre: string;
    primeraRespuestaValor: number;
    primeraRespuestaUnidad: UnidadTiempo;
    solucionValor: number;
    solucionUnidad: UnidadTiempo;
  }[] = [
    { codigo: 'CRITICA', nombre: 'Crítica', primeraRespuestaValor: 15, primeraRespuestaUnidad: 'MINUTOS', solucionValor: 4, solucionUnidad: 'HORAS' },
    { codigo: 'ALTA', nombre: 'Alta', primeraRespuestaValor: 30, primeraRespuestaUnidad: 'MINUTOS', solucionValor: 8, solucionUnidad: 'HORAS' },
    { codigo: 'MEDIA', nombre: 'Media', primeraRespuestaValor: 2, primeraRespuestaUnidad: 'HORAS', solucionValor: 2, solucionUnidad: 'DIAS_HABILES' },
    { codigo: 'BAJA', nombre: 'Baja', primeraRespuestaValor: 1, primeraRespuestaUnidad: 'DIAS_HABILES', solucionValor: 5, solucionUnidad: 'DIAS_HABILES' },
  ];
  for (const prioridad of prioridades) {
    await prisma.prioridad.upsert({
      where: { codigo: prioridad.codigo },
      update: prioridad,
      create: prioridad,
    });
  }

  for (const [codigo, nombre] of Object.entries(ESTADO_TICKET)) {
    await prisma.estadoCatalogo.upsert({
      where: { ambito_codigo: { ambito: 'ticket', codigo } },
      update: { nombre },
      create: { ambito: 'ticket', codigo, nombre },
    });
  }
  for (const [codigo, nombre] of Object.entries(ESTADO_ORDEN)) {
    await prisma.estadoCatalogo.upsert({
      where: { ambito_codigo: { ambito: 'orden', codigo } },
      update: { nombre },
      create: { ambito: 'orden', codigo, nombre },
    });
  }

  const niveles = [
    { codigo: 'N1' as const, nombre: 'Nivel 1', descripcion: 'Diagnóstico remoto y agente.' },
    { codigo: 'N2' as const, nombre: 'Nivel 2', descripcion: 'Técnico en sitio.' },
    { codigo: 'N3' as const, nombre: 'Nivel 3', descripcion: 'Especialista o proveedor.' },
  ];
  for (const nivel of niveles) {
    await prisma.nivelCatalogo.upsert({
      where: { codigo: nivel.codigo },
      update: nivel,
      create: nivel,
    });
  }

  const roles = Object.keys(PERMISOS_POR_ROL) as Rol[];
  for (const rol of roles) {
    for (const permiso of PERMISOS_POR_ROL[rol]) {
      await prisma.rolPermiso.upsert({
        where: { rol_permiso: { rol, permiso } },
        update: {},
        create: { rol, permiso },
      });
    }
  }

  await prisma.usuario.upsert({
    where: { id: IDS.ana },
    update: {},
    create: {
      id: IDS.ana,
      nombre: 'Ana Gómez',
      correoGoogle: 'ana.gomez@example.com',
      correoNotificaciones: 'ana.gomez@example.com',
      rol: 'SOLICITANTE',
      estadoAprobacion: 'APROBADO',
      tipoPersonalId: IDS.asistencial,
      areaId: IDS.area,
      sedeId: IDS.sede,
      esJefeArea: true,
    },
  });
  await prisma.usuario.upsert({
    where: { id: IDS.luis },
    update: {},
    create: {
      id: IDS.luis,
      nombre: 'Luis Pérez',
      correoGoogle: 'luis.perez@example.com',
      correoNotificaciones: 'luis.perez@example.com',
      celular: '3000000000',
      celularVerificado: true,
      rol: 'TECNICO',
      estadoAprobacion: 'APROBADO',
      tipoPersonalId: IDS.operativo,
      sedeId: IDS.sede,
      niveles: { create: [{ nivel: 'N1' }, { nivel: 'N2' }] },
    },
  });
  await prisma.usuario.upsert({
    where: { id: IDS.marta },
    update: {},
    create: {
      id: IDS.marta,
      nombre: 'Marta Ruiz',
      correoGoogle: 'marta.ruiz@example.com',
      correoNotificaciones: 'marta.ruiz@example.com',
      rol: 'ADMINISTRADOR',
      estadoAprobacion: 'APROBADO',
      tipoPersonalId: IDS.administrativo,
      sedeId: IDS.sede,
    },
  });

  await prisma.equipo.upsert({
    where: { id: IDS.equipo },
    update: {},
    create: {
      id: IDS.equipo,
      placa: 'PC-1001',
      serial: 'SN-EJEMPLO-1001',
      tipo: 'PC',
      marca: 'Ejemplo',
      modelo: 'Escritorio',
      sedeId: IDS.sede,
      areaId: IDS.area,
      ubicacionId: IDS.ubicacion,
      responsableId: IDS.ana,
      estado: 'Operativo',
    },
  });

  const parametros: { clave: string; valor: string; tipo: 'STRING' | 'NUMBER' | 'BOOLEAN'; descripcion: string }[] = [
    { clave: 'agente_ia_en_web', valor: 'false', tipo: 'BOOLEAN', descripcion: 'Chat web con el mismo agente. Por definir.' },
    { clave: 'desbloqueo_esculapio_en_mesa', valor: 'true', tipo: 'BOOLEAN', descripcion: 'Si la mesa desbloquea usuarios de Esculapio.' },
    { clave: 'gmail_requiere_aprobacion', valor: 'true', tipo: 'BOOLEAN', descripcion: 'El primer ingreso con Gmail queda pendiente de aprobación.' },
    { clave: 'canal_redireccion_software', valor: 'Envía tu solicitud al área responsable de desarrollo de software', tipo: 'STRING', descripcion: 'Texto de redirección cuando el caso es un proyecto de software.' },
    { clave: 'plazo_cierre_sin_firma_horas', valor: '48', tipo: 'NUMBER', descripcion: 'Horas para cerrar un acta sin firma.' },
    { clave: 'anticipacion_ordenes_dias', valor: '15', tipo: 'NUMBER', descripcion: 'Días de anticipación para generar la orden preventiva.' },
    { clave: 'max_intentos_guiados', valor: '2', tipo: 'NUMBER', descripcion: 'Intentos del agente antes de escalar.' },
    { clave: 'umbral_confianza_agente', valor: '0.7', tipo: 'NUMBER', descripcion: 'Umbral propuesto. Pendiente de confirmar en el piloto.' },
  ];
  for (const parametro of parametros) {
    await prisma.configuracion.upsert({
      where: { clave: parametro.clave },
      update: { valor: parametro.valor, tipo: parametro.tipo, descripcion: parametro.descripcion },
      create: parametro,
    });
  }

  await sembrarConocimiento();
  await sembrarPlantillas();
}

const ARTICULOS: { titulo: string; categoria: string; pasos: string }[] = [
  { categoria: 'Hardware', titulo: 'El monitor queda negro', pasos: 'Revisa el cable de video, prueba otro puerto y enciende el monitor.' },
  { categoria: 'Hardware', titulo: 'El teclado no escribe', pasos: 'Prueba otro puerto USB y revisa si hay una tecla atascada.' },
  { categoria: 'Hardware', titulo: 'El mouse no se mueve', pasos: 'Cambia de puerto y limpia el sensor.' },
  { categoria: 'Hardware', titulo: 'La PC no enciende', pasos: 'Verifica el cable de poder y el botón. No abras el equipo.' },
  { categoria: 'Hardware', titulo: 'El portátil se apaga solo', pasos: 'Conéctalo a la corriente y anota si se calienta.' },
  { categoria: 'Redes', titulo: 'No hay internet en el puesto', pasos: 'Revisa que el cable de red esté firme y prueba otro punto.' },
  { categoria: 'Redes', titulo: 'El Wi-Fi no aparece', pasos: 'Activa el Wi-Fi y acércate al punto de acceso del área.' },
  { categoria: 'Redes', titulo: 'La VPN no conecta', pasos: 'Confirma que hay internet y vuelve a abrir el acceso.' },
  { categoria: 'Redes', titulo: 'No abre la carpeta de red', pasos: 'Verifica que la sesión esté iniciada y la ruta sea la habitual.' },
  { categoria: 'Impresión', titulo: 'La impresora no imprime', pasos: 'Mira si está en línea y si hay papel y tóner.' },
  { categoria: 'Impresión', titulo: 'Sale la hoja en blanco', pasos: 'Revisa el tóner y la bandeja seleccionada.' },
  { categoria: 'Impresión', titulo: 'La impresora está atascada', pasos: 'Apágala, retira la hoja visible y no fuerces el mecanismo.' },
  { categoria: 'Impresión', titulo: 'No escanea', pasos: 'Cierra la tapa y elige el equipo correcto en el programa.' },
  { categoria: 'Cuentas', titulo: 'El usuario de Windows está bloqueado', pasos: 'No compartas la contraseña. Pide el desbloqueo a la mesa.' },
  { categoria: 'Cuentas', titulo: 'No entra al correo', pasos: 'Revisa mayúsculas y que el equipo tenga hora correcta.' },
  { categoria: 'Cuentas', titulo: 'No abre una carpeta compartida', pasos: 'Confirma el nombre de la carpeta y tu usuario.' },
  { categoria: 'Ofimática', titulo: 'Word no abre el archivo', pasos: 'Cierra otras copias del archivo y ábrelo de nuevo.' },
  { categoria: 'Ofimática', titulo: 'Excel va muy lento', pasos: 'Cierra libros que no uses y guarda una copia.' },
  { categoria: 'Ofimática', titulo: 'El PDF no se ve', pasos: 'Ábrelo con el lector instalado, no con el navegador.' },
  { categoria: 'Ofimática', titulo: 'El navegador no carga la intranet', pasos: 'Prueba otra página. Si ninguna abre, es la red.' },
];

async function sembrarConocimiento(): Promise<void> {
  const ids = new Map<string, string>();
  for (const nombre of ['Hardware', 'Redes', 'Impresión', 'Cuentas', 'Ofimática']) {
    const existente = await prisma.categoria.findFirst({ where: { nombre, deletedAt: null } });
    const categoria = existente ?? (await prisma.categoria.create({ data: { nombre } }));
    ids.set(nombre, categoria.id);
  }
  for (const [indice, articulo] of ARTICULOS.entries()) {
    const codigo = `KB-${String(indice + 1).padStart(3, '0')}`;
    await prisma.baseConocimiento.upsert({
      where: { codigo },
      update: {
        estado: 'PUBLICADO',
        titulo: articulo.titulo,
        pasos: articulo.pasos,
        categoriaId: ids.get(articulo.categoria),
      },
      create: {
        codigo,
        titulo: articulo.titulo,
        categoriaId: ids.get(articulo.categoria),
        pasos: articulo.pasos,
        estado: 'PUBLICADO',
        usos: 0,
        casosResueltos: 0,
        reclasificaciones: 0,
      },
    });
  }
}

async function sembrarPlantillas(): Promise<void> {
  const nombres = [
    'acta_firma',
    'recordatorio_firma',
    'codigo_verificacion',
    'ticket_creado',
    'ticket_asignado',
    'cambio_nivel',
    'ticket_resuelto',
    'ticket_descartado',
    'preventivo_proximo',
  ];
  for (const nombre of nombres) {
    await prisma.plantillaWhatsapp.upsert({
      where: { nombre },
      update: { estadoAprobacion: 'aprobada' },
      create: { nombre, contenido: `Plantilla ${nombre}`, idioma: 'es', estadoAprobacion: 'aprobada' },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
