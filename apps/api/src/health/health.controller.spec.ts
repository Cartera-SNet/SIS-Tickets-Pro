import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            vivo: () => ({ estado: 'ok' }),
            listo: async () => ({ estado: 'no_disponible', chequeos: { baseDatos: 'error' } }),
          },
        },
      ],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 en /health y en /api/health', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({ estado: 'ok' });
    await request(app.getHttpServer()).get('/api/health').expect(200).expect({ estado: 'ok' });
  });

  it('ready responde 503 sin texto de excepción', async () => {
    const respuesta = await request(app.getHttpServer()).get('/health/ready').expect(503);
    expect(respuesta.body).toEqual({
      estado: 'no_disponible',
      chequeos: { baseDatos: 'error' },
    });
    expect(JSON.stringify(respuesta.body)).not.toMatch(/error:|stack|password/i);
  });
});
