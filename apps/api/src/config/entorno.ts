export type ModoBinario = 'mock' | 'real';
export type ModoAuth = 'dev' | 'oidc';

export type Entorno = {
  nodeEnv: string;
  port: number;
  webOrigin: string;
  databaseUrl: string | null;
  secretKey: string | null;
  sessionTtlHours: number;
  trustedProxy: string | null;
  whatsappMode: ModoBinario;
  llmMode: ModoBinario;
  esculapioMode: ModoBinario;
  googleAuthMode: ModoBinario;
  authMode: ModoAuth;
  esculapioBaseUrl: string;
  uploadDir: string;
  whatsappToken: string | null;
  whatsappPhoneNumberId: string | null;
  whatsappAppSecret: string | null;
  googleClientId: string | null;
  googleClientSecret: string | null;
  googleRedirectUri: string | null;
  llmBaseUrl: string | null;
  llmApiKey: string | null;
  llmModel: string | null;
};

function modoBinario(nombre: string, valor: string | undefined): ModoBinario {
  const elegido = valor ?? 'mock';
  if (elegido !== 'mock' && elegido !== 'real') {
    throw new Error(`${nombre} debe ser mock o real.`);
  }
  return elegido;
}

export function leerEntorno(fuente: NodeJS.ProcessEnv = process.env): Entorno {
  const nodeEnv = fuente.NODE_ENV ?? 'development';
  const secretKey = fuente.SECRET_KEY?.trim() || null;
  if (nodeEnv === 'production' && !secretKey) {
    throw new Error('SECRET_KEY es obligatorio en producción.');
  }
  if (nodeEnv === 'production' && !fuente.DATABASE_URL) {
    throw new Error('DATABASE_URL es obligatorio en producción.');
  }

  const puerto = Number(fuente.PORT ?? 3000);
  if (!Number.isInteger(puerto) || puerto <= 0) {
    throw new Error('PORT debe ser un entero positivo.');
  }

  const authMode = fuente.AUTH_MODE ?? 'dev';
  if (authMode !== 'dev' && authMode !== 'oidc') {
    throw new Error('AUTH_MODE debe ser dev u oidc.');
  }

  const horas = Number(fuente.SESSION_TTL_HOURS ?? 8);
  if (!Number.isInteger(horas) || horas <= 0) {
    throw new Error('SESSION_TTL_HOURS debe ser un entero positivo.');
  }

  return {
    nodeEnv,
    port: puerto,
    webOrigin: fuente.WEB_ORIGIN ?? 'http://localhost:5173',
    databaseUrl: fuente.DATABASE_URL ?? null,
    secretKey,
    sessionTtlHours: horas,
    trustedProxy: fuente.TRUSTED_PROXY?.trim() || null,
    whatsappMode: modoBinario('WHATSAPP_MODE', fuente.WHATSAPP_MODE),
    llmMode: modoBinario('LLM_MODE', fuente.LLM_MODE),
    esculapioMode: modoBinario('ESCULAPIO_MODE', fuente.ESCULAPIO_MODE),
    googleAuthMode: modoBinario('GOOGLE_AUTH_MODE', fuente.GOOGLE_AUTH_MODE),
    authMode,
    esculapioBaseUrl:
      fuente.ESCULAPIO_BASE_URL ??
      'https://appsintranet.esculapiosis.com/ApiCampbell/api/Usuarios/',
    uploadDir: fuente.UPLOAD_DIR ?? './uploads',
    whatsappToken: fuente.WHATSAPP_TOKEN?.trim() || null,
    whatsappPhoneNumberId: fuente.WHATSAPP_PHONE_NUMBER_ID?.trim() || null,
    whatsappAppSecret: fuente.WHATSAPP_APP_SECRET?.trim() || null,
    googleClientId: fuente.GOOGLE_CLIENT_ID?.trim() || null,
    googleClientSecret: fuente.GOOGLE_CLIENT_SECRET?.trim() || null,
    googleRedirectUri: fuente.GOOGLE_REDIRECT_URI?.trim() || null,
    llmBaseUrl: fuente.LLM_BASE_URL?.trim() || null,
    llmApiKey: fuente.LLM_API_KEY?.trim() || null,
    llmModel: fuente.LLM_MODEL?.trim() || null,
  };
}

/**
 * Avisos para producción. No bloquean el arranque: el modo de demostración es válido,
 * pero deja la puerta abierta si se usa con datos reales.
 */
export function avisosProduccion(entorno: Entorno): string[] {
  if (entorno.nodeEnv !== 'production') {
    return [];
  }
  const avisos: string[] = [];
  if (entorno.authMode === 'dev') {
    avisos.push(
      'AUTH_MODE=dev permite entrar como cualquier usuario sin contraseña. Úsalo solo con datos ficticios.',
    );
  }
  if (entorno.esculapioMode === 'mock') {
    avisos.push('ESCULAPIO_MODE=mock: el ingreso con Esculapio no consulta el servicio real.');
  }
  if (entorno.googleAuthMode === 'mock') {
    avisos.push('GOOGLE_AUTH_MODE=mock: el ingreso con Gmail usa una cuenta de prueba.');
  }
  return avisos;
}
