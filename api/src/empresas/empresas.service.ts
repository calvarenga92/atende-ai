import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { conflito, naoEncontrado } from '../comum/erro-aplicacao.js';
import type { DadosEmpresa } from './dados-empresa.js';
import { EMPRESA_DEMO } from './empresa-demo.js';
import { Empresa } from './empresa.entity.js';

@Injectable()
export class EmpresasService {
  private readonly log = new Logger(EmpresasService.name);

  constructor(
    @InjectRepository(Empresa) private readonly repo: Repository<Empresa>,
  ) {}

  /** Cria a padaria demo (dev, SEMEAR_DEMO=1) ou completa a que já existe. Chamado pelo AuthService. */
  async garantirDemo(): Promise<Empresa> {
    const existente = await this.repo.findOneBy({ slug: EMPRESA_DEMO.slug });
    if (existente) {
      // Banco local criado antes dos atalhos do widget: completa sem mexer no resto.
      if (!existente.sugestoes.length) {
        existente.sugestoes = EMPRESA_DEMO.sugestoes;
        await this.repo.save(existente);
      }
      return existente;
    }
    const criada = await this.repo.save(this.repo.create(EMPRESA_DEMO));
    this.log.log(`Empresa demo criada: ${EMPRESA_DEMO.slug}`);
    return criada;
  }

  async buscarPorSlug(slug: string) {
    const empresa = await this.repo.findOneBy({ slug });
    if (!empresa) throw naoEncontrado('Empresa não encontrada.');
    return empresa;
  }

  async buscarPorId(id: string) {
    const empresa = await this.repo.findOneBy({ id });
    if (!empresa) throw naoEncontrado('Empresa não encontrada.');
    return empresa;
  }

  async atualizar(id: string, dados: Partial<DadosEmpresa>) {
    const empresa = await this.buscarPorId(id);
    if (dados.slug && dados.slug !== empresa.slug)
      await this.garantirSlugLivre(dados.slug);
    return this.repo.save(this.repo.merge(empresa, dados));
  }

  private async garantirSlugLivre(slug: string) {
    if (await this.repo.existsBy({ slug })) {
      throw conflito(`Já existe uma empresa com o slug "${slug}".`);
    }
  }
}
