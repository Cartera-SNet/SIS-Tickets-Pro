import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { puedeUsarLaMesa } from './reglas-acceso';

export const PERMISOS_KEY = 'permisos';
export const CualquierPermiso = (...permisos: string[]) => SetMetadata(PERMISOS_KEY, permisos);

@Injectable()
export class PermisoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<string[]>(PERMISOS_KEY, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    const usuario = contexto.switchToHttp().getRequest<Request>().usuario;
    if (!usuario) {
      return false;
    }
    if (!puedeUsarLaMesa(usuario.estadoAprobacion)) {
      throw new HttpException(
        { code: 'forbidden', message: 'Tu ingreso está pendiente de aprobación.' },
        HttpStatus.FORBIDDEN,
      );
    }
    if (!requeridos || requeridos.length === 0) {
      return true;
    }
    const tiene = requeridos.some((permiso) => usuario.permisos.includes(permiso));
    if (!tiene) {
      throw new HttpException(
        { code: 'forbidden', message: 'No tienes permiso para esta acción.' },
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
