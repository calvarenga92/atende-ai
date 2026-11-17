import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { conflito, naoEncontrado } from '../comum/erro-aplicacao.js';
import type { DadosEmpresa } from './dados-empresa.js';
import { EMPRESA_DEMO } from './empresa-demo.js';
import { Empresa } from './empresa.entity.js';

@Injectable()
export class EmpresasService implements OnApplicationBootstrap {
  private readonly log = new Logger(EmpresasService.name);

  constructor(
    @InjectRepository(Empresa) private readonly repo: Repository<Empresa>,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.SEMEAR_DEMO !== '1') return;
    if (await this.repo.existsBy({ slug: EMPRESA_DEMO.slug })) return;
    await this.repo.save(this.repo.create(EMPRESA_DEMO));
    this.log.log(`Empresa demo criada: ${EMPRESA_DEMO.slug}`);
  }

  listar() {
    return this.repo.find({ order: { criadoEm: 'ASC' } });
  }

  async buscarPorSlug(slug: string) {
    const empresa = await this.repo.findOneBy({ slug });
    if (!empresa) throw naoEncontrado('Empresa não encontrada.');
    return empresa;
  }

  async criar(dados: DadosEmpresa) {
    await this.garantirSlugLivre(dados.slug);
    return this.repo.save(this.repo.create(dados));
  }

  async atualizar(slug: string, dados: Partial<DadosEmpresa>) {
    const empresa = await this.buscarPorSlug(slug);
    if (dados.slug && dados.slug !== slug)
      await this.garantirSlugLivre(dados.slug);
    return this.repo.save(this.repo.merge(empresa, dados));
  }

  private async garantirSlugLivre(slug: string) {
    if (await this.repo.existsBy({ slug })) {
      throw conflito(`Já existe uma empresa com o slug "${slug}".`);
    }
  }
}
