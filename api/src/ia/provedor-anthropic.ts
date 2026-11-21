import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import type { Esforco } from '../config/ambiente.js';
import {
  chamadasDosBlocos,
  executarChamadas,
  MAX_RODADAS_FERRAMENTA,
  type MensagemIa,
  type PedidoIa,
  type ProvedorIa,
  type RespostaIa,
  separadorDeRodadas,
} from './provedor-ia.js';

/** Integração com a API paga da Anthropic. Precisa de ANTHROPIC_API_KEY. */
export class ProvedorAnthropic implements ProvedorIa {
  readonly nome: string;
  private readonly log = new Logger(ProvedorAnthropic.name);
  // Lê ANTHROPIC_API_KEY do ambiente.
  private readonly cliente = new Anthropic();

  constructor(
    private readonly modelo: string,
    private readonly esforco: Esforco,
  ) {
    this.nome = `anthropic (${modelo})`;
    if (!process.env.ANTHROPIC_API_KEY) {
      this.log.warn(
        'ANTHROPIC_API_KEY não definida: o chat vai responder com erro.',
      );
    }
  }

  async responder({
    sistema,
    contexto,
    mensagens,
    ferramentas = [],
    aoTexto,
    sinal,
  }: PedidoIa): Promise<RespostaIa> {
    const historico: Anthropic.Beta.BetaMessageParam[] = mensagens.map((m) => ({
      role: m.papel,
      content: m.conteudo as Anthropic.Beta.BetaContentBlockParam[],
    }));
    const tools: Anthropic.Beta.BetaTool[] = ferramentas.map((f) => ({
      name: f.nome,
      description: f.descricao,
      input_schema: f.parametros,
      // Entrada da ferramenta chega em streaming; quem executa valida (ver executar()).
      eager_input_streaming: true,
    }));
    const novas: MensagemIa[] = [];
    const saida = separadorDeRodadas(aoTexto);
    const uso = { entrada: 0, cacheLido: 0, cacheGravado: 0, saida: 0 };

    try {
      for (let rodada = 1; ; rodada++) {
        saida.novaRodada();
        const stream = this.cliente.beta.messages.stream(
          {
            model: this.modelo,
            max_tokens: 16000,
            output_config: { effort: this.esforco },
            // Se o modelo recusar por política, a API tenta de novo num modelo
            // de reserva na mesma chamada, em vez de deixar o visitante sem resposta.
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            // Prompt de sistema estável (persona + base de conhecimento) fica em cache.
            system: [
              {
                type: 'text',
                text: sistema,
                cache_control: { type: 'ephemeral' },
              },
              // Depois do ponto de cache: a data muda e não invalida o resto.
              ...(contexto ? [{ type: 'text' as const, text: contexto }] : []),
            ],
            // Cache automático também do histórico da conversa.
            cache_control: { type: 'ephemeral' },
            ...(tools.length ? { tools } : {}),
            messages: historico,
          },
          { signal: sinal },
        );
        stream.on('text', saida.aoTexto);
        const final = await stream.finalMessage();

        const u = final.usage;
        uso.entrada += u.input_tokens;
        uso.cacheLido += u.cache_read_input_tokens ?? 0;
        uso.cacheGravado += u.cache_creation_input_tokens ?? 0;
        uso.saida += u.output_tokens;
        const consumo = `entrada ${uso.entrada} + cache ${uso.cacheLido} lido / ${uso.cacheGravado} gravado, saída ${uso.saida}`;

        // Recusa pode cortar um pedido de ferramenta no meio: nunca executar.
        if (final.stop_reason === 'refusal') {
          this.log.warn(`Recusa: ${final.stop_details?.category ?? '?'}`);
          return { mensagens: novas, recusou: true, consumo };
        }

        // Blocos como vieram (inclusive thinking): voltam intactos na próxima rodada.
        novas.push({ papel: 'assistant', conteudo: final.content });
        historico.push({ role: 'assistant', content: final.content });

        const chamadas = chamadasDosBlocos(final.content);
        if (!chamadas.length) return { mensagens: novas, consumo };
        // Entrada cortada por limite de tokens pode parecer válida: não executar.
        if (final.stop_reason === 'max_tokens') {
          throw new Error('Pedido de ferramenta cortado por max_tokens.');
        }

        // Todo tool_use precisa de tool_result no histórico, mesmo na última rodada.
        const resultado = await executarChamadas(chamadas, ferramentas);
        novas.push(resultado);
        historico.push({
          role: 'user',
          content: resultado.conteudo as Anthropic.Beta.BetaContentBlockParam[],
        });
        if (rodada >= MAX_RODADAS_FERRAMENTA) {
          return { mensagens: novas, consumo };
        }
      }
    } catch (erro) {
      if (erro instanceof Anthropic.AuthenticationError) {
        throw new Error(
          'ANTHROPIC_API_KEY ausente ou inválida. Confira o .env.',
          {
            cause: erro,
          },
        );
      }
      if (erro instanceof Anthropic.RateLimitError) {
        throw new Error('Limite de requisições da API da Anthropic atingido.', {
          cause: erro,
        });
      }
      if (erro instanceof Anthropic.APIError) {
        throw new Error(
          `API da Anthropic respondeu ${erro.status}: ${erro.message}`,
          { cause: erro },
        );
      }
      throw erro;
    }
  }
}
