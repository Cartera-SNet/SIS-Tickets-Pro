import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { leerCookie } from '../../modules/auth/cripto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const ruta = req.originalUrl || req.url || req.path;
    if (ruta.startsWith('/webhook') || ruta.startsWith('/api/publico')) {
      next();
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }
    const cookie = leerCookie(req.header('cookie'), 'sis_csrf');
    const encabezado = req.header('x-csrf-token');
    if (!cookie || !encabezado || cookie !== encabezado) {
      res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'La solicitud no incluye la verificación de origen.',
          details: [],
          requestId: req.requestId ?? 'sin-id',
        },
      });
      return;
    }
    next();
  }
}
