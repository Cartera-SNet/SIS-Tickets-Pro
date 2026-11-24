import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { leerEntorno } from '../../config/entorno';
import { leerCookie } from './cripto';
import {
  CompletarGoogleDto,
  ConectarEsculapioDto,
  ConfirmarCelularDto,
  DevLoginDto,
  GoogleCallbackDto,
  LoginEsculapioDto,
  PerfilDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { ipCliente, puedeUsarLaMesa } from './reglas-acceso';
import { SesionGuard } from './sesion.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('csrf')
  csrf(@Req() peticion: Request, @Res({ passthrough: true }) respuesta: Response) {
    const actual = leerCookie(peticion.header('cookie'), 'sis_csrf');
    const token = actual ?? randomUUID();
    ponerCsrf(respuesta, token);
    return { token };
  }

  @Get('servidores')
  async servidores() {
    return { servidores: await this.auth.servidores() };
  }

  @Get('catalogo')
  catalogo() {
    return this.auth.catalogo();
  }

  @Post('esculapio/conectar')
  conectar(@Body() cuerpo: ConectarEsculapioDto, @Req() peticion: Request) {
    return this.auth.conectarEsculapio({ ...cuerpo, ip: ipDe(peticion) });
  }

  @Post('esculapio/login')
  async loginEsculapio(
    @Body() cuerpo: LoginEsculapioDto,
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const sesion = await this.auth.entrarEsculapio({
      ...cuerpo,
      ip: ipDe(peticion),
      userAgent: peticion.header('user-agent') ?? '',
    });
    ponerSesion(respuesta, sesion.token, sesion.csrf);
    return { autenticado: true };
  }

  @Post('google/iniciar')
  iniciarGoogle() {
    return this.auth.iniciarGoogle();
  }

  @Post('google/callback')
  callbackGoogle(@Body() cuerpo: GoogleCallbackDto) {
    return this.auth.callbackGoogleMock(cuerpo.state);
  }

  @Post('google/completar')
  async completarGoogle(
    @Body() cuerpo: CompletarGoogleDto,
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const sesion = await this.auth.completarGoogle({
      ...cuerpo,
      ip: ipDe(peticion),
      userAgent: peticion.header('user-agent') ?? '',
    });
    ponerSesion(respuesta, sesion.token, sesion.csrf);
    return { autenticado: true };
  }

  @Get('dev/usuarios')
  usuariosDev() {
    return this.auth.listarDev();
  }

  @Post('dev/login')
  async loginDev(
    @Body() cuerpo: DevLoginDto,
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const sesion = await this.auth.entrarDev(cuerpo.usuarioId, ipDe(peticion), peticion.header('user-agent') ?? '');
    ponerSesion(respuesta, sesion.token, sesion.csrf);
    return { autenticado: true };
  }

  @Get('me')
  async me(@Req() peticion: Request) {
    const usuario = await this.auth.resolver(leerCookie(peticion.header('cookie'), 'sis_sesion'));
    if (!usuario) {
      throw new UnauthorizedException({ code: 'unauthenticated', message: 'Debes iniciar sesión.' });
    }
    return {
      ...usuario,
      puedeEntrar: puedeUsarLaMesa(usuario.estadoAprobacion),
    };
  }

  @Post('logout')
  async logout(@Req() peticion: Request, @Res({ passthrough: true }) respuesta: Response) {
    await this.auth.salir(leerCookie(peticion.header('cookie'), 'sis_sesion'));
    const seguro = leerEntorno().nodeEnv === 'production';
    respuesta.clearCookie('sis_sesion', { path: '/' });
    respuesta.clearCookie('sis_csrf', { path: '/' });
    void seguro;
    return { autenticado: false };
  }

  @Post('perfil')
  @UseGuards(SesionGuard)
  perfil(@Req() peticion: Request, @Body() cuerpo: PerfilDto) {
    return this.auth.guardarPerfil(peticion.usuario!.id, cuerpo);
  }

  @Post('celular/confirmar')
  @UseGuards(SesionGuard)
  confirmar(@Req() peticion: Request, @Body() cuerpo: ConfirmarCelularDto) {
    return this.auth.confirmarCelular(peticion.usuario!.id, cuerpo.codigo);
  }
}

function ipDe(peticion: Request): string {
  return ipCliente(peticion.ip, peticion.header('x-forwarded-for'), leerEntorno().trustedProxy);
}

function ponerCsrf(respuesta: Response, token: string): void {
  const seguro = leerEntorno().nodeEnv === 'production';
  respuesta.cookie('sis_csrf', token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: seguro,
    path: '/',
    maxAge: leerEntorno().sessionTtlHours * 60 * 60 * 1000,
  });
}

function ponerSesion(respuesta: Response, token: string, csrf: string): void {
  const seguro = leerEntorno().nodeEnv === 'production';
  const maxAge = leerEntorno().sessionTtlHours * 60 * 60 * 1000;
  respuesta.cookie('sis_sesion', token, { httpOnly: true, sameSite: 'lax', secure: seguro, path: '/', maxAge });
  ponerCsrf(respuesta, csrf);
}
