import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpresasModule } from '../empresas/empresas.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GuardaAuth } from './guarda-auth.js';
import { Sessao } from './sessao.entity.js';
import { Usuario } from './usuario.entity.js';

@Module({
  imports: [EmpresasModule, TypeOrmModule.forFeature([Usuario, Sessao])],
  controllers: [AuthController],
  providers: [AuthService, GuardaAuth],
  exports: [AuthService, GuardaAuth],
})
export class AuthModule {}
