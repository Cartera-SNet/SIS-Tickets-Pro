import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  forwardRef,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { EmpresaEsculapio, EsculapioClient, GoogleAuthProvider } from '../../adapters/contratos';
import { ESCULAPIO, GOOGLE_AUTH } from '../../adapters/adaptadores.module';
import { ENTORNO } from '../../config/entorno.token';
import type { Entorno } from '../../config/entorno';
import { ColaService } from '../cola/cola.service';
import { PrismaService } from '../../prisma/prisma.service';
import { codigoSeis, crearPkce, hashToken, tokenOpaco } from './cripto';
import {
  celularEstaPermitido,
  datosPreauthEsculapio,
  empresaPermitida,
  evaluarIntento,
  mensajeCredenciales,
  POLITICA_REINTENTO,
  registrarFallo,
  type EstadoIntentos,
} from './reglas-acceso';

const PREAUTH_MS = 10 * 60 * 1000;
const CODIGO_MS = 10 * 60 * 1000;
const VERSION_DATOS = 'LEY-1581-2012';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ESCULAPIO) private readonly esculapio: EsculapioClient,
    @Inject(GOOGLE_AUTH) private readonly google: GoogleAuthProvider,
    @Inject(forwardRef(() => ColaService)) private readonly cola: ColaService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async servidores(): Promise<{ id: string; descripcion: string; ip: string; puerto: number; usuario: string }[]> {
    const lista = await this.esculapio.obtenerServidores();
    return lista
      .filter((servidor) => servidor.Descripcion?.trim())
      .map((servidor) => ({
        id: String(servidor.$id ?? ''),
        descripcion: servidor.Descripcion.trim(),
        ip: servidor.Ip_Conexion,
        puerto: Number(servidor.Puerto ?? 3306),
        usuario: servidor.Usuario ?? '',
      }));
  }

  async conectarEsculapio(entrada: { servidor: string; usuario: string; password: string; ip: string }) {
    return this.enBase(async () => {
      const ahora = Date.now();
      const estado = await this.leerIntentos(entrada.ip);
      if (!evaluarIntento(estado, ahora).permitido) {
        throw new HttpException(
          { code: 'rate_limited', message: 'Demasiados intentos. Espera un momento.' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const servidores = await this.esculapio.obtenerServidores();
      const servidor = servidores.find((item) => item.Descripcion?.trim() === entrada.servidor);
      if (!servidor) {
        throw new NotFoundException({ code: 'not_found', message: 'No se encontró el servidor.' });
      }
      const empresas = await this.esculapio.obtenerEmpresas({
        ipConexion: servidor.Ip_Conexion,
        usuario: entrada.usuario,
        password: entrada.password,
        puerto: Number(servidor.Puerto ?? 3306),
      });
      if (empresas.length === 0) {
        const paso = registrarFallo(estado, ahora);
        await this.guardarIntentos(entrada.ip, paso.siguiente);
        throw new UnauthorizedException({
          code: 'unauthenticated',
          message: mensajeCredenciales(paso.restantes),
        });
      }
      await this.prisma.intentoAcceso.deleteMany({ where: { ip: entrada.ip } });
      const token = tokenOpaco();
      const datos = datosPreauthEsculapio({
        usuario: entrada.usuario,
        servidor: entrada.servidor,
        empresas,
      });
      await this.prisma.preautenticacion.create({
        data: {
          tokenHash: hashToken(token),
          metodo: 'ESCULAPIO',
          usuarioEsculapio: datos.usuarioEsculapio,
          servidorEsculapio: datos.servidorEsculapio,
          nombre: entrada.usuario,
          empresas: datos.empresas,
          expira: new Date(ahora + PREAUTH_MS),
        },
      });
      return { token, empresas };
    });
  }

  async entrarEsculapio(entrada: { token: string; empresa: string; ip: string; userAgent: string }) {
    return this.enBase(async () => {
      const previa = await this.tomarPreauth(entrada.token, 'ESCULAPIO');
      const empresas = (previa.empresas ?? []) as EmpresaEsculapio[];
      if (!empresaPermitida(empresas, entrada.empresa)) {
        throw new UnauthorizedException({
          code: 'unauthenticated',
          message: 'La empresa no corresponde a la validación.',
        });
      }
      const elegida = empresas.find((empresa) => empresa.cod === entrada.empresa);
      const sede = await this.prisma.sede.findFirst({
        where: {
          deletedAt: null,
          OR: [{ codigoEsculapio: entrada.empresa }, { nombre: elegida?.sede ?? '' }],
        },
      });
      const usuario = await this.buscarOCrearEsculapio({
        usuario: previa.usuarioEsculapio ?? '',
        servidor: previa.servidorEsculapio ?? '',
        nombre: previa.nombre ?? previa.usuarioEsculapio ?? 'Colaborador',
        sedeId: sede?.id ?? null,
      });
      return this.abrirSesion(usuario.id, 'ESCULAPIO', entrada.empresa, sede?.id ?? null, entrada.ip, entrada.userAgent);
    });
  }

  async iniciarGoogle() {
    return this.enBase(async () => {
      const { verifier, challenge } = crearPkce();
      const state = tokenOpaco();
      await this.prisma.preautenticacion.create({
        data: {
          tokenHash: hashToken(state),
          metodo: 'GOOGLE',
          state,
          codeVerifier: verifier,
          empresas: [],
          expira: new Date(Date.now() + PREAUTH_MS),
        },
      });
      return {
        state,
        url: this.google.urlAutorizacion(state, challenge),
        modo: this.entorno.googleAuthMode,
      };
    });
  }

  async callbackGoogleMock(state: string) {
    return this.enBase(async () => {
      const previa = await this.prisma.preautenticacion.findFirst({
        where: { state, usado: false, metodo: 'GOOGLE', expira: { gt: new Date() } },
      });
      if (!previa) {
        throw new UnauthorizedException({ code: 'unauthenticated', message: 'El ingreso con Gmail venció. Intenta de nuevo.' });
      }
      await this.prisma.preautenticacion.update({
        where: { id: previa.id },
        data: { correoGoogle: 'persona.prueba@gmail.com', nombre: 'Persona Prueba' },
      });
      return { token: state, correo: 'persona.prueba@gmail.com', nombre: 'Persona Prueba' };
    });
  }

  async completarGoogle(entrada: {
    token: string;
    sedeId: string;
    areaId: string;
    correoNotificaciones: string;
    ip: string;
    userAgent: string;
  }) {
    return this.enBase(async () => {
      const previa = await this.tomarPreauth(entrada.token, 'GOOGLE');
      if (!previa.correoGoogle) {
        throw new UnauthorizedException({ code: 'unauthenticated', message: 'Falta confirmar el correo de Gmail.' });
      }
      const requiere = await this.gmailRequiereAprobacion();
      const existente = await this.prisma.usuario.findUnique({ where: { correoGoogle: previa.correoGoogle } });
      const usuario =
        existente ??
        (await this.prisma.usuario.create({
          data: {
            nombre: previa.nombre ?? 'Colaborador',
            correoGoogle: previa.correoGoogle,
            correoNotificaciones: entrada.correoNotificaciones,
            rol: 'SOLICITANTE',
            estadoAprobacion: requiere ? 'PENDIENTE' : 'APROBADO',
            tipoPersonalId: await this.tipoPorDefecto(),
            sedeId: entrada.sedeId,
            areaId: entrada.areaId,
          },
        }));
      return this.abrirSesion(usuario.id, 'GOOGLE', null, entrada.sedeId, entrada.ip, entrada.userAgent);
    });
  }

  async entrarDev(usuarioId: string, ip: string, userAgent: string) {
    if (this.entorno.authMode !== 'dev') {
      throw new NotFoundException({ code: 'not_found', message: 'No se encontró el recurso.' });
    }
    return this.enBase(async () => {
      const usuario = await this.prisma.usuario.findFirst({ where: { id: usuarioId, deletedAt: null, activo: true } });
      if (!usuario) {
        throw new NotFoundException({ code: 'not_found', message: 'No se encontró el usuario de prueba.' });
      }
      return this.abrirSesion(usuario.id, 'DEV', null, usuario.sedeId, ip, userAgent);
    });
  }

  async listarDev() {
    if (this.entorno.authMode !== 'dev') {
      throw new NotFoundException({ code: 'not_found', message: 'No se encontró el recurso.' });
    }
    return this.enBase(() =>
      this.prisma.usuario.findMany({
        where: { deletedAt: null, activo: true },
        select: { id: true, nombre: true, rol: true, correoGoogle: true },
        orderBy: { nombre: 'asc' },
        take: 20,
      }),
    );
  }

  async resolver(token: string | null) {
    if (!token) {
      return null;
    }
    return this.enBase(async () => {
      const sesion = await this.prisma.sesion.findUnique({
        where: { tokenHash: hashToken(token) },
        include: {
          usuario: {
            include: {
              sede: true,
              area: true,
              tipoPersonal: true,
              niveles: true,
            },
          },
        },
      });
      if (!sesion || sesion.expira < new Date() || sesion.usuario.deletedAt || !sesion.usuario.activo) {
        return null;
      }
      const permisos = await this.prisma.rolPermiso.findMany({
        where: { rol: sesion.usuario.rol },
        select: { permiso: true },
      });
      const usuario = sesion.usuario;
      return {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        sedeId: usuario.sedeId,
        sedeNombre: usuario.sede?.nombre ?? null,
        areaId: usuario.areaId,
        niveles: usuario.niveles.map((nivel) => nivel.nivel),
        estadoAprobacion: usuario.estadoAprobacion,
        permisos: permisos.map((fila) => fila.permiso),
        celularVerificado: usuario.celularVerificado,
        correoNotificaciones: usuario.correoNotificaciones,
        ubicacionHabitualId: usuario.ubicacionHabitualId,
        celularPermitido: celularEstaPermitido(
          usuario.tipoPersonal.celularPermitido,
          usuario.area?.celularPermitido ?? null,
        ),
        metodo: sesion.metodoAuth,
        faltaPerfil: !usuario.correoNotificaciones || !usuario.ubicacionHabitualId,
      };
    });
  }

  async salir(token: string | null) {
    if (!token) {
      return;
    }
    await this.enBase(() => this.prisma.sesion.deleteMany({ where: { tokenHash: hashToken(token) } }));
  }

  async guardarPerfil(
    usuarioId: string,
    entrada: { correoNotificaciones: string; ubicacionHabitualId: string; celular?: string; autorizaDatos?: boolean },
  ) {
    return this.enBase(async () => {
      const usuario = await this.prisma.usuario.findUniqueOrThrow({
        where: { id: usuarioId },
        include: { area: true, tipoPersonal: true },
      });
      await this.prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          correoNotificaciones: entrada.correoNotificaciones,
          ubicacionHabitualId: entrada.ubicacionHabitualId,
          consentimientoDatosVersion: VERSION_DATOS,
          consentimientoDatosFecha: new Date(),
        },
      });
      if (!entrada.celular) {
        return { requiereCodigo: false as const };
      }
      if (!celularEstaPermitido(usuario.tipoPersonal.celularPermitido, usuario.area?.celularPermitido ?? null)) {
        throw new HttpException(
          { code: 'forbidden', message: 'Tu área no tiene celular autorizado. Usa la web y el correo.' },
          HttpStatus.FORBIDDEN,
        );
      }
      if (!entrada.autorizaDatos) {
        throw new HttpException(
          { code: 'validation_error', message: 'Debes autorizar el tratamiento de datos para verificar el celular.' },
          HttpStatus.BAD_REQUEST,
        );
      }
      const codigo = codigoSeis();
      await this.prisma.codigoCelular.updateMany({ where: { usuarioId, usado: false }, data: { usado: true } });
      await this.prisma.codigoCelular.create({
        data: {
          usuarioId,
          celular: entrada.celular,
          hash: hashToken(codigo),
          expira: new Date(Date.now() + CODIGO_MS),
        },
      });
      const texto = `SIS: tu código de verificación es ${codigo}. Vence en 10 minutos.`;
      try {
        await this.cola.encolar('whatsapp', { destino: entrada.celular, texto }, POLITICA_REINTENTO);
      } catch (error) {
        if (this.entorno.whatsappMode === 'real') {
          throw error;
        }
      }
      return {
        requiereCodigo: true as const,
        codigoPrueba: this.entorno.whatsappMode === 'mock' ? codigo : undefined,
      };
    });
  }

  async confirmarCelular(usuarioId: string, codigo: string) {
    return this.enBase(async () => {
      const vigente = await this.prisma.codigoCelular.findFirst({
        where: { usuarioId, usado: false },
        orderBy: { expira: 'desc' },
      });
      if (!vigente || vigente.expira < new Date() || vigente.intentos >= 5) {
        throw new UnauthorizedException({ code: 'unauthenticated', message: 'El código venció. Pide uno nuevo.' });
      }
      if (vigente.hash !== hashToken(codigo)) {
        await this.prisma.codigoCelular.update({ where: { id: vigente.id }, data: { intentos: { increment: 1 } } });
        throw new UnauthorizedException({ code: 'unauthenticated', message: 'El código no coincide.' });
      }
      await this.prisma.codigoCelular.update({ where: { id: vigente.id }, data: { usado: true } });
      await this.prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          celular: vigente.celular,
          celularVerificado: true,
          autorizacionWhatsapp: true,
          autorizacionWhatsappVersion: VERSION_DATOS,
        },
      });
      return { celularVerificado: true };
    });
  }

  async catalogo() {
    return this.enBase(async () => {
      const [sedes, areas, ubicaciones] = await Promise.all([
        this.prisma.sede.findMany({ where: { deletedAt: null, activo: true }, select: { id: true, nombre: true }, take: 100 }),
        this.prisma.area.findMany({
          where: { deletedAt: null, activo: true },
          select: { id: true, nombre: true, sedeId: true, celularPermitido: true },
          take: 200,
        }),
        this.prisma.ubicacion.findMany({
          where: { deletedAt: null, activo: true },
          select: { id: true, nombre: true, sedeId: true, piso: true },
          take: 300,
        }),
      ]);
      return { sedes, areas, ubicaciones };
    });
  }

  async cambiarAprobacion(usuarioId: string, estado: 'APROBADO' | 'RECHAZADO') {
    return this.enBase(() =>
      this.prisma.usuario.update({
        where: { id: usuarioId },
        data: { estadoAprobacion: estado },
        select: { id: true, estadoAprobacion: true },
      }),
    );
  }

  private async abrirSesion(
    usuarioId: string,
    metodo: 'ESCULAPIO' | 'GOOGLE' | 'DEV',
    empresaCodigo: string | null,
    sedeId: string | null,
    ip: string,
    userAgent: string,
  ) {
    const token = tokenOpaco();
    const csrf = tokenOpaco();
    const expira = new Date(Date.now() + this.entorno.sessionTtlHours * 60 * 60 * 1000);
    await this.prisma.sesion.create({
      data: {
        usuarioId,
        tokenHash: hashToken(token),
        metodoAuth: metodo,
        empresaCodigo,
        sedeId,
        expira,
        ip,
        userAgent,
      },
    });
    return { token, csrf };
  }

  private async tomarPreauth(token: string, metodo: 'ESCULAPIO' | 'GOOGLE') {
    const previa = await this.prisma.preautenticacion.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!previa || previa.usado || previa.metodo !== metodo || previa.expira < new Date()) {
      throw new UnauthorizedException({ code: 'unauthenticated', message: 'La validación venció. Vuelve a ingresar.' });
    }
    await this.prisma.preautenticacion.update({ where: { id: previa.id }, data: { usado: true } });
    return previa;
  }

  private async buscarOCrearEsculapio(entrada: { usuario: string; servidor: string; nombre: string; sedeId: string | null }) {
    const existente = await this.prisma.usuario.findFirst({
      where: { usuarioEsculapio: entrada.usuario, servidorEsculapio: entrada.servidor, deletedAt: null },
    });
    if (existente) {
      if (entrada.sedeId && existente.sedeId !== entrada.sedeId) {
        return this.prisma.usuario.update({ where: { id: existente.id }, data: { sedeId: entrada.sedeId } });
      }
      return existente;
    }
    return this.prisma.usuario.create({
      data: {
        nombre: entrada.nombre,
        usuarioEsculapio: entrada.usuario,
        servidorEsculapio: entrada.servidor,
        rol: 'SOLICITANTE',
        estadoAprobacion: 'APROBADO',
        tipoPersonalId: await this.tipoPorDefecto(),
        sedeId: entrada.sedeId,
      },
    });
  }

  private async tipoPorDefecto(): Promise<string> {
    const tipo = await this.prisma.tipoPersonal.findFirst({
      where: { deletedAt: null, activo: true },
      orderBy: { nombre: 'asc' },
    });
    if (!tipo) {
      throw new ServiceUnavailableException({
        code: 'internal_error',
        message: 'No hay tipos de personal configurados.',
      });
    }
    return tipo.id;
  }

  private async gmailRequiereAprobacion(): Promise<boolean> {
    const fila = await this.prisma.configuracion.findUnique({ where: { clave: 'gmail_requiere_aprobacion' } });
    return fila?.valor !== 'false';
  }

  private async leerIntentos(ip: string): Promise<EstadoIntentos | null> {
    const fila = await this.prisma.intentoAcceso.findUnique({ where: { ip } });
    if (!fila) {
      return null;
    }
    return {
      intentos: fila.intentos,
      primerIntento: fila.primerIntento.getTime(),
      bloqueadoHasta: fila.bloqueadoHasta?.getTime() ?? null,
    };
  }

  private async guardarIntentos(ip: string, estado: EstadoIntentos) {
    await this.prisma.intentoAcceso.upsert({
      where: { ip },
      create: {
        ip,
        intentos: estado.intentos,
        primerIntento: new Date(estado.primerIntento),
        bloqueadoHasta: estado.bloqueadoHasta ? new Date(estado.bloqueadoHasta) : null,
      },
      update: {
        intentos: estado.intentos,
        primerIntento: new Date(estado.primerIntento),
        bloqueadoHasta: estado.bloqueadoHasta ? new Date(estado.bloqueadoHasta) : null,
      },
    });
  }

  private async enBase<T>(accion: () => Promise<T>): Promise<T> {
    try {
      return await accion();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const texto = error instanceof Error ? error.message : '';
      if (/Can't reach database|ECONNREFUSED|P1001|P2021|P2022/.test(texto)) {
        throw new ServiceUnavailableException({
          code: 'internal_error',
          message: 'La base de datos no está disponible.',
        });
      }
      throw error;
    }
  }
}
