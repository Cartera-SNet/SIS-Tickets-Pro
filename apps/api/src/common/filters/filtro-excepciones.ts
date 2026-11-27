import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { redactarSecretos } from '../../adapters/redactar-url';

type CuerpoError = {
  error: {
    code: string;
    message: string;
    details: { field: string; reason: string }[];
    requestId: string;
  };
};

const CODIGO_POR_ESTADO: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'validation_error',
  [HttpStatus.UNAUTHORIZED]: 'unauthenticated',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.CONFLICT]: 'conflict',
  [HttpStatus.TOO_MANY_REQUESTS]: 'rate_limited',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'internal_error',
};

const MENSAJE_POR_CODIGO: Record<string, string> = {
  validation_error: 'Los datos enviados no son válidos.',
  unauthenticated: 'Debes iniciar sesión.',
  forbidden: 'No tienes permiso para esta acción.',
  not_found: 'No se encontró el recurso.',
  conflict: 'El dato ya existe o fue modificado.',
  rate_limited: 'Demasiados intentos. Espera un momento.',
  internal_error: 'Ocurrió un error interno.',
};

@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly logger = new Logger(FiltroExcepciones.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const respuesta = ctx.getResponse<Response>();
    const peticion = ctx.getRequest<Request>();
    const requestId = peticion.requestId ?? 'sin-id';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let message = MENSAJE_POR_CODIGO.internal_error;
    let details: { field: string; reason: string }[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = CODIGO_POR_ESTADO[status] ?? 'internal_error';
      const explicito = mensajeExplicito(exception.getResponse());
      if (explicito) {
        code = explicito.code;
        message = redactarSecretos(explicito.message).slice(0, 200);
      } else {
        details = detallesDeValidacion(exception.getResponse());
        message = MENSAJE_POR_CODIGO[code] ?? MENSAJE_POR_CODIGO.internal_error;
      }
    } else {
      const texto = exception instanceof Error ? exception.message : 'error';
      const demasiadoGrande =
        /entity too large|payload too large|request entity too large/i.test(texto) ||
        (exception as { type?: string; status?: number })?.type === 'entity.too.large' ||
        (exception as { status?: number })?.status === 413;
      if (demasiadoGrande) {
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        code = 'validation_error';
        message = 'El archivo es demasiado grande. Máximo 5 MB.';
      } else {
        this.logger.error(
          JSON.stringify({
            msg: 'error_no_controlado',
            requestId,
            detalle: redactarSecretos(texto),
          }),
        );
      }
    }

    const cuerpo: CuerpoError = {
      error: {
        code,
        message,
        details,
        requestId,
      },
    };
    respuesta.status(status).json(cuerpo);
  }
}

function mensajeExplicito(body: unknown): { code: string; message: string } | null {
  if (!body || typeof body !== 'object' || !('code' in body) || !('message' in body)) {
    return null;
  }
  const codigo = (body as { code: unknown }).code;
  const mensaje = (body as { message: unknown }).message;
  if (typeof codigo !== 'string' || typeof mensaje !== 'string') {
    return null;
  }
  if (!Object.values(CODIGO_POR_ESTADO).includes(codigo) && codigo !== 'internal_error') {
    return null;
  }
  return { code: codigo, message: mensaje };
}

function detallesDeValidacion(body: unknown): { field: string; reason: string }[] {
  if (!body || typeof body !== 'object' || !('message' in body)) {
    return [];
  }
  const message = (body as { message: unknown }).message;
  if (!Array.isArray(message)) {
    return [];
  }
  return message.slice(0, 20).map((item) => ({
    field: 'general',
    reason: typeof item === 'string' ? item : 'valor no válido',
  }));
}
