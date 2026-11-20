import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { UsuarioLogado } from '../auth/auth.service.js';
import { GuardaAuth, UsuarioAtual } from '../auth/guarda-auth.js';
import { validarDadosEmpresa } from '../empresas/dados-empresa.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import { LeadsService } from '../leads/leads.service.js';

/**
 * Rotas do painel admin. A empresa sai sempre do login, nunca da URL:
 * não existe como pedir os dados de outra empresa.
 */
@Controller('painel')
@UseGuards(GuardaAuth)
export class PainelController {
  constructor(
    private readonly empresas: EmpresasService,
    private readonly leads: LeadsService,
  ) {}

  @Get('empresa')
  empresa(@UsuarioAtual() usuario: UsuarioLogado) {
    return this.empresas.buscarPorId(usuario.empresaId);
  }

  /** Persona, base de conhecimento, cor, sugestões. Trocar o slug muda a tag do widget. */
  @Patch('empresa')
  atualizar(@UsuarioAtual() usuario: UsuarioLogado, @Body() corpo: unknown) {
    return this.empresas.atualizar(
      usuario.empresaId,
      validarDadosEmpresa(corpo, true),
    );
  }

  @Get('leads')
  listarLeads(@UsuarioAtual() usuario: UsuarioLogado) {
    return this.leads.listar(usuario.empresaId);
  }
}
