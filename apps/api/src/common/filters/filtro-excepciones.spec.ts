import { BadRequestException, HttpException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { FiltroExcepciones } from './filtro-excepciones';

function hostCon(body: { status: jest.Mock; json: jest.Mock }, requestId = 'req-1'): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => body,
      getRequest: () => ({ requestId }),
    }),
  } as unknown as ArgumentsHost;
}

describe('FiltroExcepciones', () => {
  it('no devuelve el detalle interno ni secretos de la URL', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const filtro = new FiltroExcepciones();
    filtro.catch(new Error('fallo PasswordUsu=clave-real'), hostCon({ status, json }));
    expect(status).toHaveBeenCalledWith(500);
    const cuerpo = json.mock.calls[0][0] as { error: { code: string; message: string } };
    expect(cuerpo.error.code).toBe('internal_error');
    expect(cuerpo.error.message).not.toContain('clave-real');
    expect(JSON.stringify(cuerpo)).not.toContain('clave-real');
  });

  it('traduce una validación a 400', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const filtro = new FiltroExcepciones();
    const excepcion = new BadRequestException({ message: ['titulo es obligatorio'], error: 'Bad Request' });
    filtro.catch(excepcion, hostCon({ status, json }));
    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0][0].error.code).toBe('validation_error');
    expect(json.mock.calls[0][0].error.details).toEqual([
      { field: 'general', reason: 'titulo es obligatorio' },
    ]);
  });

  it('mapea 403 a forbidden', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    new FiltroExcepciones().catch(new HttpException('no', 403), hostCon({ status, json }));
    expect(json.mock.calls[0][0].error.code).toBe('forbidden');
    expect(json.mock.calls[0][0].error.message).toBe('No tienes permiso para esta acción.');
  });
});
