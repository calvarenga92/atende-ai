import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversa } from '../conversas/conversa.entity.js';
import { Mensagem } from '../conversas/mensagem.entity.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import { PROVEDOR_IA, type ProvedorIa } from '../ia/provedor-ia.js';
import { montarPromptSistema } from './prompt-sistema.js';

/** O que o chat manda para o navegador, em ordem. */
export type EventoChat =
  | { tipo: 'inicio'; conversaId: string }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'fim' }
  | { tipo: 'erro'; mensagem: string };

const MSG_RECUSA =
  'Desculpe, não consigo ajudar com isso por aqui. Posso ajudar com outra coisa?';
const MSG_FALHA =
  'Tive um problema para responder agora. Pode tentar de novo em instantes?';

@Injectable()
export class ChatService {
  private readonly log = new Logger(ChatService.name);

  constructor(
    private readonly empresas: EmpresasService,
    @Inject(PROVEDOR_IA) private readonly ia: ProvedorIa,
    @InjectRepository(Conversa)
    private readonly conversas: Repository<Conversa>,
    @InjectRepository(Mensagem)
    private readonly mensagens: Repository<Mensagem>,
  ) {}

  async configuracaoPublica(slug: string) {
    const e = await this.empresas.buscarPorSlug(slug);
    return {
      nome: e.nome,
      nomeBot: e.nomeBot,
      mensagemBoasVindas: e.mensagemBoasVindas,
      corPrimaria: e.corPrimaria,
    };
  }

  /**
   * Responde uma mensagem do visitante em streaming.
   * Empresa inexistente sobe antes de qualquer evento (vira 404 normal);
   * depois do `inicio`, falhas viram evento `erro`.
   */
  async responder(
    slug: string,
    conversaId: string | undefined,
    texto: string,
    emitir: (evento: EventoChat) => void,
    sinal: AbortSignal,
  ): Promise<void> {
    const empresa = await this.empresas.buscarPorSlug(slug);
    const conversa = await this.obterConversa(empresa.id, conversaId);
    emitir({ tipo: 'inicio', conversaId: conversa.id });

    const historico = await this.mensagens.find({
      where: { conversaId: conversa.id },
      order: { id: 'ASC' },
    });
    const pergunta = await this.mensagens.save(
      this.mensagens.create({
        conversaId: conversa.id,
        papel: 'user',
        conteudo: [{ type: 'text', text: texto }],
      }),
    );

    try {
      const resposta = await this.ia.responder({
        sistema: montarPromptSistema(empresa),
        mensagens: [...historico, pergunta].map((m) => ({
          papel: m.papel,
          conteudo: m.conteudo,
        })),
        aoTexto: (pedaco) => emitir({ tipo: 'texto', texto: pedaco }),
        sinal,
      });

      let conteudo = resposta.conteudo;
      if (resposta.recusou) {
        emitir({ tipo: 'texto', texto: MSG_RECUSA });
        conteudo = [{ type: 'text', text: MSG_RECUSA }];
      }
      await this.mensagens.save(
        this.mensagens.create({
          conversaId: conversa.id,
          papel: 'assistant',
          conteudo,
        }),
      );
      if (resposta.consumo) {
        this.log.log(
          `conversa ${conversa.id} · ${this.ia.nome}: ${resposta.consumo}`,
        );
      }
      emitir({ tipo: 'fim' });
    } catch (erro) {
      if (sinal.aborted) return; // visitante fechou a página
      this.log.error(
        `${this.ia.nome}: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
      emitir({ tipo: 'erro', mensagem: MSG_FALHA });
    }
  }

  private async obterConversa(empresaId: string, conversaId?: string) {
    if (conversaId) {
      const existente = await this.conversas.findOneBy({
        id: conversaId,
        empresaId,
      });
      if (existente) return existente;
    }
    return this.conversas.save(this.conversas.create({ empresaId }));
  }
}
