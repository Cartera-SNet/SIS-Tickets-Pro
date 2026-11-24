import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { leerCookie } from './cripto';
import { AuthService } from './auth.service';

@Injectable()
export class SesionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const peticion = contexto.switchToHttp().getRequest<Request>();
    const usuario = await this.auth.resolver(leerCookie(peticion.header('cookie'), 'sis_sesion'));
    if (!usuario) {
      throw new UnauthorizedException({ code: 'unauthenticated', message: 'Debes iniciar sesión.' });
    }
    peticion.usuario = usuario;
    return true;
  }
}
