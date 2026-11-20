import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EmpresasService } from '../empresas/empresas.service.js';
import { AuthService, type UsuarioLogado } from './auth.service.js';
import { validarCadastro, validarEntrada } from './dados-auth.js';
import { GuardaAuth, UsuarioAtual } from './guarda-auth.js';

/** Conta do painel: criar, entrar, sair e "quem sou eu". */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly empresas: EmpresasService,
  ) {}

  @Post('cadastro')
  cadastrar(@Body() corpo: unknown) {
    return this.auth.cadastrar(validarCadastro(corpo));
  }

  @Post('entrar')
  @HttpCode(200)
  entrar(@Body() corpo: unknown, @Ip() ip: string) {
    return this.auth.entrar(validarEntrada(corpo), ip);
  }

  @Post('sair')
  @HttpCode(204)
  @UseGuards(GuardaAuth)
  async sair(@UsuarioAtual() usuario: UsuarioLogado) {
    await this.auth.sair(usuario.sessaoId);
  }

  @Get('eu')
  @UseGuards(GuardaAuth)
  async eu(@UsuarioAtual() usuario: UsuarioLogado) {
    return {
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      empresa: await this.empresas.buscarPorId(usuario.empresaId),
    };
  }
}
