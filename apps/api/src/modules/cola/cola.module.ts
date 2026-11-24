import { Global, Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ColaController } from './cola.controller';
import { ColaService } from './cola.service';

@Global()
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [ColaController],
  providers: [ColaService],
  exports: [ColaService],
})
export class ColaModule {}
