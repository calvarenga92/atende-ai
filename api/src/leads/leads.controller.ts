import { Controller, Get, Param } from '@nestjs/common';
import { EmpresasService } from '../empresas/empresas.service.js';
import { LeadsService } from './leads.service.js';

/**
 * Leads de uma empresa (uso do painel admin).
 * ATENÇÃO: ainda sem autenticação. Só rodar local até a etapa 5 (login do painel).
 */
@Controller('empresas/:slug/leads')
export class LeadsController {
  constructor(
    private readonly empresas: EmpresasService,
    private readonly leads: LeadsService,
  ) {}

  @Get()
  async listar(@Param('slug') slug: string) {
    const empresa = await this.empresas.buscarPorSlug(slug);
    return this.leads.listar(empresa.id);
  }
}
