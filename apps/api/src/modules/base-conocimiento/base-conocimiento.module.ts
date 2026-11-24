import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CualquierPermiso, PermisoGuard } from '../auth/permiso.guard';
import { SesionGuard } from '../auth/sesion.guard';
import { Module } from '@nestjs/common';

class ArticuloDto {
  @IsString()
  @MinLength(4)
  @MaxLength(140)
  titulo!: string;

  @IsUUID()
  categoriaId!: string;

  @IsString()
  @MinLength(8)
  pasos!: string;
}

class PublicarDto {
  @IsIn(['BORRADOR', 'PUBLICADO'])
  estado!: 'BORRADOR' | 'PUBLICADO';
}

@Injectable()
export class BaseConocimientoService {
  constructor(private readonly prisma: PrismaService) {}

  async sugerencias(categoriaId: string) {
    return this.prisma.baseConocimiento.findMany({
      where: { categoriaId, estado: 'PUBLICADO', deletedAt: null },
      orderBy: { usos: 'desc' },
      take: 5,
      select: { id: true, codigo: true, titulo: true, pasos: true },
    });
  }

  async listar(estado?: string, texto?: string, categoriaId?: string) {
    return this.prisma.baseConocimiento.findMany({
      where: {
        deletedAt: null,
        ...(estado ? { estado: estado as 'BORRADOR' | 'PUBLICADO' } : {}),
        ...(categoriaId ? { categoriaId } : {}),
        ...(texto
          ? { OR: [{ titulo: { contains: texto, mode: 'insensitive' } }, { pasos: { contains: texto, mode: 'insensitive' } }] }
          : {}),
      },
      orderBy: { codigo: 'asc' },
      include: { categoria: { select: { nombre: true } } },
    });
  }

  async crear(entrada: { titulo: string; categoriaId: string; pasos: string }) {
    const total = await this.prisma.baseConocimiento.count();
    return this.prisma.baseConocimiento.create({
      data: {
        codigo: `KB-${String(total + 1).padStart(3, '0')}`,
        titulo: entrada.titulo.trim(),
        categoriaId: entrada.categoriaId,
        pasos: entrada.pasos.trim(),
        estado: 'BORRADOR',
      },
    });
  }

  async publicar(id: string, estado: 'BORRADOR' | 'PUBLICADO') {
    const articulo = await this.prisma.baseConocimiento.findUnique({ where: { id } });
    if (!articulo) {
      throw new HttpException({ code: 'not_found', message: 'No se encontró el artículo.' }, HttpStatus.NOT_FOUND);
    }
    return this.prisma.baseConocimiento.update({ where: { id }, data: { estado } });
  }
}

@Controller('api/conocimiento')
@UseGuards(SesionGuard, PermisoGuard)
export class BaseConocimientoController {
  constructor(private readonly conocimiento: BaseConocimientoService) {}

  @Get('sugerencias')
  sugerencias(@Query('categoriaId') categoriaId = '') {
    return this.conocimiento.sugerencias(categoriaId);
  }

  @Get()
  listar(@Query('estado') estado?: string, @Query('q') texto?: string, @Query('categoriaId') categoriaId?: string) {
    return this.conocimiento.listar(estado, texto, categoriaId);
  }

  @Post()
  @CualquierPermiso('kb.aprobar', 'tickets.ver_sede')
  crear(@Body() cuerpo: ArticuloDto) {
    return this.conocimiento.crear(cuerpo);
  }

  @Patch(':id')
  @CualquierPermiso('kb.aprobar')
  publicar(@Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: PublicarDto) {
    return this.conocimiento.publicar(id, cuerpo.estado);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [BaseConocimientoController],
  providers: [BaseConocimientoService],
})
export class BaseConocimientoModule {}
