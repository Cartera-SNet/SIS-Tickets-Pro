import { Injectable } from '@nestjs/common';
import { ConfiguracionRepository } from './configuracion.repository';

export class ErrorDeConfiguracion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeConfiguracion';
  }
}

@Injectable()
export class ConfiguracionService {
  constructor(private readonly repositorio: ConfiguracionRepository) {}

  async texto(clave: string, defecto: string): Promise<string> {
    const fila = await this.repositorio.buscarPorClave(clave);
    if (!fila) {
      return defecto;
    }
    if (fila.tipo !== 'STRING') {
      throw new ErrorDeConfiguracion(`La clave ${clave} no es texto.`);
    }
    return fila.valor;
  }

  async booleano(clave: string, defecto: boolean): Promise<boolean> {
    const fila = await this.repositorio.buscarPorClave(clave);
    if (!fila) {
      return defecto;
    }
    if (fila.tipo !== 'BOOLEAN' || (fila.valor !== 'true' && fila.valor !== 'false')) {
      throw new ErrorDeConfiguracion(`La clave ${clave} no es booleana.`);
    }
    return fila.valor === 'true';
  }

  async numero(clave: string, defecto: number): Promise<number> {
    const fila = await this.repositorio.buscarPorClave(clave);
    if (!fila) {
      return defecto;
    }
    if (fila.tipo !== 'NUMBER' || Number.isNaN(Number(fila.valor))) {
      throw new ErrorDeConfiguracion(`La clave ${clave} no es numérica.`);
    }
    return Number(fila.valor);
  }
}
