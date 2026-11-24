import type { Entorno } from '../config/entorno';
import { GoogleAuthReal, LlmReal, WhatsAppReal, crearGoogle, crearLlm, crearWhatsapp } from './proveedores';
import { EsculapioMock, crearEsculapio } from './esculapio';

const base: Entorno = {
  nodeEnv: 'test',
  port: 3000,
  webOrigin: 'http://localhost:5173',
  databaseUrl: null,
  secretKey: null,
  sessionTtlHours: 8,
  trustedProxy: null,
  whatsappMode: 'mock',
  llmMode: 'mock',
  esculapioMode: 'mock',
  googleAuthMode: 'mock',
  authMode: 'dev',
  esculapioBaseUrl: 'https://example.test/',
  uploadDir: './uploads',
  whatsappToken: null,
  whatsappPhoneNumberId: null,
  whatsappAppSecret: null,
  googleClientId: null,
  googleClientSecret: null,
  googleRedirectUri: null,
  llmBaseUrl: null,
  llmApiKey: null,
  llmModel: null,
};

describe('adaptadores', () => {
  it('en mock no llama a la red y devuelve la sede de ejemplo', async () => {
    const cliente = crearEsculapio(base);
    expect(cliente).toBeInstanceOf(EsculapioMock);
    const empresas = await cliente.obtenerEmpresas({
      ipConexion: '10.0.0.10',
      usuario: 'ana',
      password: 'no-se-guarda',
      puerto: 3306,
    });
    expect(empresas).toEqual([{ cod: '01', nombre: 'Clínica Ejemplo', sede: 'Sede Norte' }]);
  });

  it('WhatsApp, el modelo y Google reales no arrancan sin credenciales', async () => {
    const real: Entorno = {
      ...base,
      whatsappMode: 'real',
      llmMode: 'real',
      googleAuthMode: 'real',
    };
    await expect(crearWhatsapp(real).enviarTexto('300', 'hola')).rejects.toThrow(/no está configurado/);
    await expect(crearLlm(real).chat([], [])).rejects.toThrow(/no está configurado/);
    expect(() => crearGoogle(real).urlAutorizacion('estado', 'reto')).toThrow(/no está configurado/);
    expect(crearWhatsapp(real)).toBeInstanceOf(WhatsAppReal);
    expect(crearLlm(real)).toBeInstanceOf(LlmReal);
    expect(crearGoogle(real)).toBeInstanceOf(GoogleAuthReal);
  });

  it('la URL de Google incluye PKCE y no una contraseña', () => {
    const url = crearGoogle({
      ...base,
      googleAuthMode: 'real',
      googleClientId: 'cliente',
      googleRedirectUri: 'http://localhost/callback',
    }).urlAutorizacion('abc', 'reto-pkce');
    expect(url).toContain('code_challenge=reto-pkce');
    expect(url).toContain('code_challenge_method=S256');
    expect(url.toLowerCase()).not.toContain('password');
  });
});
