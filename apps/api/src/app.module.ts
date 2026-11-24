import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AdaptadoresModule } from './adapters/adaptadores.module';
import { IdPeticionMiddleware } from './common/middleware/id-peticion';
import { CsrfMiddleware } from './common/middleware/csrf';
import { leerEntorno } from './config/entorno';
import { HealthModule } from './health/health.module';
import { ColaModule } from './modules/cola/cola.module';
import { ActasModule } from './modules/actas/actas.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { PanelModule } from './modules/panel/panel.module';
import { AdministracionModule } from './modules/administracion/administracion.module';
import { AgenteIaModule } from './modules/agente-ia/agente-ia.module';
import { AuthModule } from './modules/auth/auth.module';
import { BaseConocimientoModule } from './modules/base-conocimiento/base-conocimiento.module';
import { CatalogosModule } from './modules/catalogos/catalogos.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';
import { NivelesModule } from './modules/niveles/niveles.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { PreventivoModule } from './modules/preventivo/preventivo.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { PrismaModule } from './prisma/prisma.module';

const entorno = leerEntorno();

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    ConfiguracionModule,
    AdaptadoresModule.register(entorno),
    ColaModule,
    AuthModule,
    TicketsModule,
    NivelesModule,
    AgenteIaModule,
    WhatsappModule,
    NotificacionesModule,
    BaseConocimientoModule,
    CatalogosModule,
    PreventivoModule,
    ActasModule,
    PanelModule,
    AuditoriaModule,
    ReportesModule,
    AdministracionModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(IdPeticionMiddleware, CsrfMiddleware).forRoutes('{*path}');
  }
}
