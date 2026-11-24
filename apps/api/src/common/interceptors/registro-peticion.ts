import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RegistroPeticionInterceptor implements NestInterceptor {
  private readonly logger = new Logger('http');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{ method: string; route?: { path?: string }; path: string; requestId?: string }>();
    const inicio = Date.now();
    const ruta = req.route?.path ?? req.path;
    return next.handle().pipe(
      tap(() => {
        const res = http.getResponse<{ statusCode: number }>();
        const evento = {
          msg: 'http_request',
          requestId: req.requestId ?? '',
          method: req.method,
          route: ruta,
          status: res.statusCode,
          durationMs: Date.now() - inicio,
        };
        if (ruta === '/health' || ruta === '/health/ready') {
          this.logger.debug(JSON.stringify(evento));
          return;
        }
        this.logger.log(JSON.stringify(evento));
      }),
    );
  }
}
