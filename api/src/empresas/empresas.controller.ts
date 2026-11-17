import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { type DadosEmpresa, validarDadosEmpresa } from './dados-empresa.js';
import { EmpresasService } from './empresas.service.js';

/**
 * Cadastro das empresas (uso do painel admin).
 * ATENÇÃO: ainda sem autenticação. Só rodar local até a etapa 5 (login do painel).
 */
@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  @Get()
  listar() {
    return this.empresas.listar();
  }

  @Get(':slug')
  buscar(@Param('slug') slug: string) {
    return this.empresas.buscarPorSlug(slug);
  }

  @Post()
  criar(@Body() corpo: unknown) {
    return this.empresas.criar(
      validarDadosEmpresa(corpo, false) as DadosEmpresa,
    );
  }

  @Patch(':slug')
  atualizar(@Param('slug') slug: string, @Body() corpo: unknown) {
    return this.empresas.atualizar(slug, validarDadosEmpresa(corpo, true));
  }
}
