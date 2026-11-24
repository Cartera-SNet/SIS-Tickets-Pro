import { Module, forwardRef } from '@nestjs/common';
import { ENTORNO } from '../../config/entorno.token';
import { leerEntorno } from '../../config/entorno';
import { ColaModule } from '../cola/cola.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermisoGuard } from './permiso.guard';
import { SesionGuard } from './sesion.guard';
import { UsuariosController } from './usuarios.controller';

@Module({
  imports: [forwardRef(() => ColaModule)],
  controllers: [AuthController, UsuariosController],
  providers: [AuthService, SesionGuard, PermisoGuard, { provide: ENTORNO, useFactory: () => leerEntorno() }],
  exports: [AuthService, SesionGuard, PermisoGuard],
})
export class AuthModule {}
