import { DynamicModule, Module } from '@nestjs/common';
import type { Entorno } from '../config/entorno';
import { crearEsculapio } from './esculapio';
import { crearGoogle, crearLlm, crearWhatsapp } from './proveedores';

export const ESCULAPIO = Symbol('ESCULAPIO');
export const WHATSAPP = Symbol('WHATSAPP');
export const LLM = Symbol('LLM');
export const GOOGLE_AUTH = Symbol('GOOGLE_AUTH');

@Module({})
export class AdaptadoresModule {
  static register(entorno: Entorno): DynamicModule {
    return {
      module: AdaptadoresModule,
      global: true,
      providers: [
        { provide: ESCULAPIO, useValue: crearEsculapio(entorno) },
        { provide: WHATSAPP, useValue: crearWhatsapp(entorno) },
        { provide: LLM, useValue: crearLlm(entorno) },
        { provide: GOOGLE_AUTH, useValue: crearGoogle(entorno) },
      ],
      exports: [ESCULAPIO, WHATSAPP, LLM, GOOGLE_AUTH],
    };
  }
}
