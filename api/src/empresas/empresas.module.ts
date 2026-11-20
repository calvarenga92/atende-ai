import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Empresa } from './empresa.entity.js';
import { EmpresasService } from './empresas.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Empresa])],
  providers: [EmpresasService],
  exports: [EmpresasService],
})
export class EmpresasModule {}
