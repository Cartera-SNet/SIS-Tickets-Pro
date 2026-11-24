import { Body, Controller, Get, HttpException, HttpStatus, Module, Patch, Req, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { SesionGuard } from '../auth/sesion.guard';
import { ConfiguracionRepository } from './configuracion.repository';
import { ConfiguracionService } from './configuracion.service';

class AgenteConfigDto {
  @IsNumber()
  @Min(0.1)
  @Max(0.99)
  umbral!: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  intentosGuiados!: number;

  @IsString()
  @MaxLength(2000)
  reglasPrivacidad!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  topeDiario?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  topeMensual?: number;
}

@Controller('api/configuracion')
@UseGuards(SesionGuard, PermisoGuard)
export class ConfiguracionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('agente')
  @CualquierPermiso('configuracion.editar')
  async agente() {
    const filas = await this.prisma.configuracion.findMany({
      where: {
        clave: {
          in: [
            'umbral_confianza_agente',
            'max_intentos_guiados',
            'reglas_privacidad_agente',
            'tope_diario_agente',
            'tope_mensual_agente',
          ],
        },
      },
    });
    const valor = (clave: string, defecto: string) => filas.find((fila) => fila.clave === clave)?.valor ?? defecto;
    return {
      umbral: Number(valor('umbral_confianza_agente', '0.7')),
      intentosGuiados: Number(valor('max_intentos_guiados', '2')),
      reglasPrivacidad: valor(
        'reglas_privacidad_agente',
        'No procesar datos clínicos ni contraseñas. No enviar imágenes al modelo.',
      ),
      topeDiario: Number(valor('tope_diario_agente', '200')),
      topeMensual: Number(valor('tope_mensual_agente', '4000')),
    };
  }

  @Patch('agente')
  @CualquierPermiso('configuracion.editar')
  async guardarAgente(@Req() peticion: Request, @Body() cuerpo: AgenteConfigDto) {
    const previo = await this.agente();
    const cambios: { clave: string; valor: string; tipo: 'NUMBER' | 'STRING'; descripcion: string }[] = [
      { clave: 'umbral_confianza_agente', valor: String(cuerpo.umbral), tipo: 'NUMBER', descripcion: 'Umbral de confianza del agente.' },
      { clave: 'max_intentos_guiados', valor: String(cuerpo.intentosGuiados), tipo: 'NUMBER', descripcion: 'Intentos guiados antes de escalar.' },
      { clave: 'reglas_privacidad_agente', valor: cuerpo.reglasPrivacidad.trim(), tipo: 'STRING', descripcion: 'Reglas de privacidad del agente.' },
      { clave: 'tope_diario_agente', valor: String(cuerpo.topeDiario ?? previo.topeDiario), tipo: 'NUMBER', descripcion: 'Tope diario de turnos del modelo.' },
      { clave: 'tope_mensual_agente', valor: String(cuerpo.topeMensual ?? previo.topeMensual), tipo: 'NUMBER', descripcion: 'Tope mensual de turnos del modelo.' },
    ];
    for (const cambio of cambios) {
      if (/secret|token|password|clave/i.test(cambio.clave)) {
        throw new HttpException({ code: 'forbidden', message: 'Ese valor no se guarda en la base.' }, HttpStatus.FORBIDDEN);
      }
      await this.prisma.configuracion.upsert({
        where: { clave: cambio.clave },
        update: { valor: cambio.valor, tipo: cambio.tipo },
        create: cambio,
      });
    }
    await this.prisma.historial.create({
      data: {
        usuarioId: peticion.usuario!.id,
        tipo: 'configuracion_agente',
        datosPrevios: previo as unknown as Prisma.InputJsonValue,
        datosNuevos: cuerpo as unknown as Prisma.InputJsonValue,
      },
    });
    return this.agente();
  }

  @Get('integraciones')
  @CualquierPermiso('configuracion.editar')
  integraciones() {
    return {
      whatsappModo: process.env.WHATSAPP_MODE ?? 'mock',
      secretoConfigurado: (process.env.WHATSAPP_APP_SECRET ?? '').length > 0,
      tokenVerificacionConfigurado: (process.env.WHATSAPP_VERIFY_TOKEN ?? '').length > 0,
      origen: 'variables de entorno',
    };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [ConfiguracionController],
  providers: [ConfiguracionRepository, ConfiguracionService],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
