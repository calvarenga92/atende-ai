import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import type { Esforco } from '../config/ambiente.js';
import type { PedidoIa, ProvedorIa, RespostaIa } from './provedor-ia.js';

/** Claude, pela API paga da Anthropic. Precisa de ANTHROPIC_API_KEY. */
export class ProvedorAnthropic implements ProvedorIa {
  readonly nome: string;
  private readonly log = new Logger(ProvedorAnthropic.name);
  // Lê ANTHROPIC_API_KEY do ambiente.
  private readonly claude = new Anthropic();

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
    mensagens,
    aoTexto,
    sinal,
  }: PedidoIa): Promise<RespostaIa> {
    try {
      const stream = this.claude.beta.messages.stream(
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
          ],
          // Cache automático também do histórico da conversa.
          cache_control: { type: 'ephemeral' },
          messages: mensagens.map((m) => ({
            role: m.papel,
            content: m.conteudo as Anthropic.Beta.BetaContentBlockParam[],
          })),
        },
        { signal: sinal },
      );

      stream.on('text', aoTexto);
      const final = await stream.finalMessage();
      const u = final.usage;
      const consumo =
        `entrada ${u.input_tokens} + cache ${u.cache_read_input_tokens ?? 0} lido / ` +
        `${u.cache_creation_input_tokens ?? 0} gravado, saída ${u.output_tokens}`;

      if (final.stop_reason === 'refusal') {
        this.log.warn(`Recusa: ${final.stop_details?.category ?? '?'}`);
        return { conteudo: [], recusou: true, consumo };
      }
      // Blocos como vieram (inclusive thinking): voltam intactos na próxima rodada.
      return { conteudo: final.content, consumo };
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
        throw new Error('Limite de requisições da API da Claude atingido.', {
          cause: erro,
        });
      }
      if (erro instanceof Anthropic.APIError) {
        throw new Error(
          `API da Claude respondeu ${erro.status}: ${erro.message}`,
          {
            cause: erro,
          },
        );
      }
      throw erro;
    }
  }
}
