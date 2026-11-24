export type ServidorEsculapio = {
  $id: string;
  Descripcion: string;
  Ip_Conexion: string;
  Puerto: number;
  Usuario: string;
};

export type EmpresaEsculapio = {
  cod: string;
  nombre: string;
  sede: string;
};

export type CredencialesEsculapio = {
  ipConexion: string;
  usuario: string;
  password: string;
  puerto: number;
};

export interface EsculapioClient {
  readonly modo: 'mock' | 'real';
  obtenerServidores(): Promise<ServidorEsculapio[]>;
  obtenerEmpresas(credenciales: CredencialesEsculapio): Promise<EmpresaEsculapio[]>;
}

export interface WhatsAppProvider {
  readonly modo: 'mock' | 'real';
  enviarTexto(destino: string, texto: string): Promise<{ id: string }>;
}

export interface LlmProvider {
  readonly modo: 'mock' | 'real';
  chat(
    mensajes: { role: 'system' | 'user' | 'assistant'; content: string }[],
    herramientas: string[],
  ): Promise<{ content: string; toolCalls: [] }>;
}

export interface GoogleAuthProvider {
  readonly modo: 'mock' | 'real';
  urlAutorizacion(state: string, codeChallenge: string): string;
}
