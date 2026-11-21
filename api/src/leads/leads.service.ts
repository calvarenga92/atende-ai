import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FerramentaIa } from '../ia/provedor-ia.js';
import { validarLead } from './dados-lead.js';
import { Lead } from './lead.entity.js';

@Injectable()
export class LeadsService {
  private readonly log = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead) private readonly repo: Repository<Lead>,
  ) {}

  listar(empresaId: string) {
    return this.repo.find({
      where: { empresaId },
      order: { criadoEm: 'DESC' },
    });
  }

  /**
   * Ferramenta `salvar_lead` presa a uma conversa: a IA só informa os dados da pessoa,
   * nunca para qual empresa ou conversa salvar (isso não pode vir do modelo).
   * `aoSalvar` roda depois de gravar, para o chat avisar o visitante.
   */
  ferramentaSalvar(
    empresaId: string,
    conversaId: string,
    aoSalvar?: () => void,
  ): FerramentaIa {
    return {
      nome: 'salvar_lead',
      descricao:
        'Salva o nome e o contato de um visitante interessado, para a equipe da empresa retornar. ' +
        'Use só quando a pessoa já tiver informado, nesta conversa, o nome e um telefone com DDD ou e-mail. ' +
        'Nunca invente dados. Se chamar de novo na mesma conversa, os dados são atualizados.',
      parametros: {
        type: 'object',
        properties: {
          nome: {
            type: 'string',
            description: 'Nome da pessoa, como ela informou.',
          },
          contato: {
            type: 'string',
            description: 'Telefone com DDD ou e-mail, como a pessoa informou.',
          },
          interesse: {
            type: 'string',
            description:
              'Resumo curto do que a pessoa quer (produto, data, quantidade...).',
          },
        },
        required: ['nome', 'contato', 'interesse'],
      },
      executar: async (entrada) => {
        const v = validarLead(entrada);
        if (!v.ok) {
          return {
            erro: true,
            texto: `[Aviso interno, não repita para a pessoa] Contato não salvo: ${v.problemas.join('; ')}. Com suas palavras, peça à pessoa só o que falta e chame salvar_lead de novo quando ela responder.`,
          };
        }
        await this.repo.upsert({ empresaId, conversaId, ...v.dados }, [
          'conversaId',
        ]);
        this.log.log(
          `Lead salvo na conversa ${conversaId} (${v.dados.tipoContato})`,
        );
        aoSalvar?.();
        const primeiroNome = v.dados.nome.split(' ')[0];
        return {
          texto: 'Contato salvo. A confirmação já foi mostrada à pessoa.',
          respostaPronta: `Pronto, ${primeiroNome}! Já passei seu contato para a equipe, que vai falar com você em breve para combinar os detalhes. Posso ajudar com mais alguma coisa?`,
        };
      },
    };
  }
}
