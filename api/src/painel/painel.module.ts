import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EmpresasModule } from '../empresas/empresas.module.js';
import { LeadsModule } from '../leads/leads.module.js';
import { PainelController } from './painel.controller.js';

@Module({
  imports: [AuthModule, EmpresasModule, LeadsModule],
  controllers: [PainelController],
})
export class PainelModule {}
