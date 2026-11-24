import { Module } from '@nestjs/common';
import { ActasModule } from '../actas/actas.module';
import { AuthModule } from '../auth/auth.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { PreventivoController } from './preventivo.controller';
import { PreventivoService } from './preventivo.service';

@Module({
  imports: [AuthModule, ActasModule, NotificacionesModule],
  controllers: [PreventivoController],
  providers: [PreventivoService],
})
export class PreventivoModule {}
