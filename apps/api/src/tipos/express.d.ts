import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    usuario?: {
      id: string;
      nombre: string;
      rol: string;
      sedeId: string | null;
      sedeNombre: string | null;
      permisos: string[];
      estadoAprobacion: string;
      niveles: string[];
      faltaPerfil: boolean;
      puedeEntrar?: boolean;
    };
  }
}
