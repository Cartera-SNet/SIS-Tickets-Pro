import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const ENCABEZADO_PETICION = 'x-request-id';

@Injectable()
export class IdPeticionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const entrante = req.header(ENCABEZADO_PETICION);
    const requestId = entrante && entrante.length <= 80 ? entrante : randomUUID();
    req.requestId = requestId;
    res.setHeader(ENCABEZADO_PETICION, requestId);
    next();
  }
}
