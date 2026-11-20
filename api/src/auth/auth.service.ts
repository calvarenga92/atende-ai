import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import {
  conflito,
  muitasTentativas,
  naoAutenticado,
} from '../comum/erro-aplicacao.js';
import { Empresa } from '../empresas/empresa.entity.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import type { DadosCadastro, DadosEntrada } from './dados-auth.js';
import { LimiteTentativas } from './limite-tentativas.js';
import {
  conferirSenha,
  gerarHashSenha,
  gerarToken,
  HASH_FALSO,
  hashToken,
} from './senha.js';
import { Sessao } from './sessao.entity.js';
import { Usuario } from './usuario.entity.js';

export const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60_000;

/** Conta de demonstração, criada só em dev (SEMEAR_DEMO=1) junto com a padaria. */
export const USUARIO_DEMO = {
  nome: 'Equipe Pão de Ouro',
  email: 'demo@padaria-demo.local',
  senha: 'demo12345',
};

/** O que a guarda pendura na requisição e as rotas do painel recebem. */
export interface UsuarioLogado {
  id: string;
  nome: string;
  email: string;
  empresaId: string;
  sessaoId: string;
}

export interface Login {
  token: string;
  expiraEm: Date;
  usuario: { id: string; nome: string; email: string };
  empresa: Empresa;
}

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly log = new Logger(AuthService.name);
  private readonly limite = new LimiteTentativas();

  constructor(
    private readonly banco: DataSource,
    private readonly empresas: EmpresasService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Sessao) private readonly sessoes: Repository<Sessao>,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.SEMEAR_DEMO !== '1') return;
    const empresa = await this.empresas.garantirDemo();
    if (await this.usuarios.existsBy({ email: USUARIO_DEMO.email })) return;
    await this.usuarios.save(
      this.usuarios.create({
        empresaId: empresa.id,
        nome: USUARIO_DEMO.nome,
        email: USUARIO_DEMO.email,
        senhaHash: await gerarHashSenha(USUARIO_DEMO.senha),
      }),
    );
    this.log.log(`Conta demo criada: ${USUARIO_DEMO.email}`);
  }

  /** Cria empresa e conta juntas (ou nenhuma das duas) e já devolve a sessão. */
  async cadastrar(dados: DadosCadastro): Promise<Login> {
    const senhaHash = await gerarHashSenha(dados.senha);
    const { usuario, empresa } = await this.banco.transaction(async (m) => {
      if (await m.existsBy(Usuario, { email: dados.email })) {
        throw conflito('Já existe uma conta com este e-mail.');
      }
      if (await m.existsBy(Empresa, { slug: dados.empresa.slug })) {
        throw conflito(
          `O endereço "${dados.empresa.slug}" já está em uso. Escolha outro.`,
        );
      }
      const empresa = await m.save(m.create(Empresa, dados.empresa));
      const usuario = await m.save(
        m.create(Usuario, {
          empresaId: empresa.id,
          nome: dados.nome,
          email: dados.email,
          senhaHash,
        }),
      );
      return { usuario, empresa };
    });
    this.log.log(`Conta criada para a empresa ${empresa.slug}`);
    return this.abrirSessao(usuario, empresa);
  }

  /** `origem` (IP) entra na chave do limite junto com o e-mail. */
  async entrar(dados: DadosEntrada, origem: string): Promise<Login> {
    const chave = `${origem}|${dados.email}`;
    const minutos = this.limite.bloqueado(chave);
    if (minutos) {
      throw muitasTentativas(
        `Muitas tentativas. Tente de novo em ${minutos} min.`,
      );
    }

    const usuario = await this.usuarios.findOne({
      where: { email: dados.email },
      select: {
        id: true,
        nome: true,
        email: true,
        empresaId: true,
        senhaHash: true,
      },
    });
    // Sem conta, confere contra um hash falso: o tempo de resposta não entrega
    // quais e-mails estão cadastrados.
    const ok = await conferirSenha(
      dados.senha,
      usuario?.senhaHash ?? (await HASH_FALSO),
    );
    if (!usuario || !ok) {
      this.limite.falhou(chave);
      throw naoAutenticado('E-mail ou senha incorretos.');
    }
    this.limite.acertou(chave);

    // Aproveita o login para varrer sessões vencidas.
    await this.sessoes.delete({ expiraEm: LessThan(new Date()) });
    const empresa = await this.empresas.buscarPorId(usuario.empresaId);
    return this.abrirSessao(usuario, empresa);
  }

  async sair(sessaoId: string): Promise<void> {
    await this.sessoes.delete({ id: sessaoId });
  }

  /** Token do cabeçalho → quem está logado. Token desconhecido ou vencido: 401. */
  async autenticar(token: string): Promise<UsuarioLogado> {
    const sessao = await this.sessoes.findOneBy({
      tokenHash: hashToken(token),
    });
    if (!sessao || sessao.expiraEm.getTime() <= Date.now()) {
      throw naoAutenticado('Sua sessão expirou. Entre de novo.');
    }
    const usuario = await this.usuarios.findOneBy({ id: sessao.usuarioId });
    if (!usuario) throw naoAutenticado();
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      empresaId: usuario.empresaId,
      sessaoId: sessao.id,
    };
  }

  private async abrirSessao(usuario: Usuario, empresa: Empresa) {
    const token = gerarToken();
    const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
    await this.sessoes.save(
      this.sessoes.create({
        usuarioId: usuario.id,
        tokenHash: hashToken(token),
        expiraEm,
      }),
    );
    return {
      token,
      expiraEm,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      empresa,
    };
  }
}
