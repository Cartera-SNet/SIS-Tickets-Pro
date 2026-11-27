import './config/railway';
import 'reflect-metadata';
import { config as cargarEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { avisosProduccion, leerEntorno } from './config/entorno';
import { FiltroExcepciones } from './common/filters/filtro-excepciones';
import { RegistroPeticionInterceptor } from './common/interceptors/registro-peticion';

cargarEnv({ path: resolve(__dirname, '../../../.env') });
cargarEnv({ path: resolve(process.cwd(), '.env') });

const RUTAS_DE_LA_API = ['/api', '/health', '/webhook', '/socket.io'];

async function bootstrap(): Promise<void> {
  const entorno = leerEntorno();
  for (const aviso of avisosProduccion(entorno)) {
    console.warn(`[aviso] ${aviso}`);
  }
  // bodyParser:false + useBodyParser: sube el límite (default 100kb) para evidencias base64.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '8mb' });
  app.useBodyParser('urlencoded', { limit: '8mb', extended: true });

  // Detrás del proxy de Railway la IP real llega en X-Forwarded-For.
  const saltos = Number(process.env.TRUST_PROXY_HOPS ?? (process.env.RAILWAY_ENVIRONMENT_NAME ? 1 : 0));
  if (Number.isInteger(saltos) && saltos > 0) {
    app.set('trust proxy', saltos);
  }

  app.enableShutdownHooks();
  app.useWebSocketAdapter(new IoAdapter(app));
  app.use(helmet());
  app.enableCors({
    origin: entorno.webOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new FiltroExcepciones());
  app.useGlobalInterceptors(new RegistroPeticionInterceptor());

  // Un solo servicio: la API también entrega la web compilada (mismo origen, sin CORS).
  const carpetaWeb = resolve(process.env.WEB_DIST_DIR ?? join(__dirname, '../../web/dist'));
  const indiceWeb = join(carpetaWeb, 'index.html');
  if (existsSync(indiceWeb)) {
    app.useStaticAssets(carpetaWeb, {
      index: false,
      setHeaders: (respuesta, ruta) => {
        if (ruta.endsWith('index.html')) {
          respuesta.setHeader('Cache-Control', 'no-cache');
        } else if (/[\\/]assets[\\/]/.test(ruta)) {
          // Archivos con hash en el nombre: nunca cambian, se pueden guardar un año.
          respuesta.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          // Logo, íconos y demás archivos públicos con nombre fijo: revalidar cada hora.
          respuesta.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    });
    app.use((peticion: Request, respuesta: Response, siguiente: NextFunction) => {
      const esLectura = peticion.method === 'GET' || peticion.method === 'HEAD';
      const esDeLaApi = RUTAS_DE_LA_API.some((ruta) => peticion.path === ruta || peticion.path.startsWith(`${ruta}/`));
      const esNavegacion = (peticion.headers.accept ?? '').includes('text/html');
      if (!esLectura || esDeLaApi || !esNavegacion) {
        siguiente();
        return;
      }
      respuesta.setHeader('Cache-Control', 'no-cache');
      respuesta.sendFile(indiceWeb);
    });
  }

  await app.listen(entorno.port);
}

void bootstrap();
