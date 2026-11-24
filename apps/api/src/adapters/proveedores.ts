import type { Entorno } from '../config/entorno';
import type { GoogleAuthProvider, LlmProvider, WhatsAppProvider } from './contratos';

export class WhatsAppMock implements WhatsAppProvider {
  readonly modo = 'mock' as const;

  async enviarTexto(destino: string, texto: string): Promise<{ id: string }> {
    if (!destino || !texto) {
      throw new Error('El mensaje de WhatsApp necesita destino y texto.');
    }
    return { id: `mock-${destino.length}-${texto.length}` };
  }
}

export class WhatsAppReal implements WhatsAppProvider {
  readonly modo = 'real' as const;

  constructor(
    private readonly token: string | null,
    private readonly phoneNumberId: string | null,
  ) {}

  async enviarTexto(destino: string, texto: string): Promise<{ id: string }> {
    if (!this.token || !this.phoneNumberId) {
      throw new Error('WhatsApp real no está configurado.');
    }
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 10_000);
    try {
      const respuesta = await fetch(
        `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: destino,
            type: 'text',
            text: { body: texto },
          }),
          signal: controlador.signal,
        },
      );
      if (!respuesta.ok) {
        throw new Error(`WhatsApp respondió ${respuesta.status}`);
      }
      const cuerpo = (await respuesta.json()) as { messages?: { id: string }[] };
      return { id: cuerpo.messages?.[0]?.id ?? 'sin-id' };
    } finally {
      clearTimeout(temporizador);
    }
  }
}

export class LlmMock implements LlmProvider {
  readonly modo = 'mock' as const;

  async chat(): Promise<{ content: string; toolCalls: [] }> {
    return {
      content: 'Puedo orientarte con los artículos publicados. Si no alcanza, te paso con un analista.',
      toolCalls: [],
    };
  }
}

export class LlmReal implements LlmProvider {
  readonly modo = 'real' as const;

  constructor(
    private readonly baseUrl: string | null,
    private readonly apiKey: string | null,
    private readonly model: string | null,
  ) {}

  async chat(
    mensajes: { role: 'system' | 'user' | 'assistant'; content: string }[],
    _herramientas: string[],
  ): Promise<{ content: string; toolCalls: [] }> {
    if (!this.baseUrl || !this.apiKey || !this.model) {
      throw new Error('El modelo de IA real no está configurado.');
    }
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 20_000);
    try {
      const respuesta = await fetch(new URL('/chat/completions', asegurarBarra(this.baseUrl)), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: this.model, messages: mensajes }),
        signal: controlador.signal,
      });
      if (!respuesta.ok) {
        throw new Error(`El modelo respondió ${respuesta.status}`);
      }
      const cuerpo = (await respuesta.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return { content: cuerpo.choices?.[0]?.message?.content ?? '', toolCalls: [] };
    } finally {
      clearTimeout(temporizador);
    }
  }
}

export class GoogleAuthMock implements GoogleAuthProvider {
  readonly modo = 'mock' as const;

  urlAutorizacion(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `http://localhost/mock-google?${params.toString()}`;
  }
}

export class GoogleAuthReal implements GoogleAuthProvider {
  readonly modo = 'real' as const;

  constructor(
    private readonly clientId: string | null,
    private readonly redirectUri: string | null,
  ) {}

  urlAutorizacion(state: string, codeChallenge: string): string {
    if (!this.clientId || !this.redirectUri) {
      throw new Error('Google OAuth no está configurado.');
    }
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
}

export function crearWhatsapp(entorno: Entorno): WhatsAppProvider {
  if (entorno.whatsappMode === 'real') {
    return new WhatsAppReal(entorno.whatsappToken, entorno.whatsappPhoneNumberId);
  }
  return new WhatsAppMock();
}

export function crearLlm(entorno: Entorno): LlmProvider {
  if (entorno.llmMode === 'real') {
    return new LlmReal(entorno.llmBaseUrl, entorno.llmApiKey, entorno.llmModel);
  }
  return new LlmMock();
}

export function crearGoogle(entorno: Entorno): GoogleAuthProvider {
  if (entorno.googleAuthMode === 'real') {
    return new GoogleAuthReal(entorno.googleClientId, entorno.googleRedirectUri);
  }
  return new GoogleAuthMock();
}

function asegurarBarra(base: string): string {
  return base.endsWith('/') ? base : `${base}/`;
}
