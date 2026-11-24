import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ConectarEsculapioDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  servidor!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  usuario!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class LoginEsculapioDto {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  empresa!: string;
}

export class GoogleCallbackDto {
  @IsString()
  @MinLength(10)
  state!: string;
}

export class CompletarGoogleDto {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsUUID()
  sedeId!: string;

  @IsUUID()
  areaId!: string;

  @IsEmail()
  correoNotificaciones!: string;
}

export class DevLoginDto {
  @IsUUID()
  usuarioId!: string;
}

export class PerfilDto {
  @IsEmail()
  correoNotificaciones!: string;

  @IsUUID()
  ubicacionHabitualId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  celular?: string;

  @IsOptional()
  @IsBoolean()
  autorizaDatos?: boolean;
}

export class ConfirmarCelularDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  codigo!: string;
}

export class AprobarDto {
  @IsIn(['APROBADO', 'RECHAZADO'])
  estado!: 'APROBADO' | 'RECHAZADO';
}
