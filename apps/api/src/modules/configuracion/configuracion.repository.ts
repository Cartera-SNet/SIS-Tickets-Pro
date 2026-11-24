import { Injectable } from '@nestjs/common';
import type { TipoConfiguracion } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type FilaConfiguracion = {
  clave: string;
  valor: string;
  tipo: TipoConfiguracion;
};

@Injectable()
export class ConfiguracionRepository {
  constructor(private readonly prisma: PrismaService) {}

  buscarPorClave(clave: string): Promise<FilaConfiguracion | null> {
    return this.prisma.configuracion.findUnique({
      where: { clave },
      select: { clave: true, valor: true, tipo: true },
    });
  }
}
