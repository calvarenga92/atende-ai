import { setTimeout as esperar } from 'node:timers/promises';
import {
  type PedidoIa,
  type ProvedorIa,
  type RespostaIa,
  textoDosBlocos,
} from './provedor-ia.js';

/**
 * IA de mentira: custo zero, nada para instalar. Serve para desenvolver o resto
 * do produto (widget, leads, painel) e para a demo pública do portfólio.
 * Responde em pedaços, com pausa, para exercitar o streaming de verdade.
 */
export class ProvedorSimulado implements ProvedorIa {
  readonly nome = 'simulado';

  constructor(private readonly pausaMs = 40) {}

  async responder({
    mensagens,
    aoTexto,
    sinal,
  }: PedidoIa): Promise<RespostaIa> {
    const ultima = mensagens.at(-1);
    const pergunta = ultima ? textoDosBlocos(ultima.conteudo).trim() : '';
    const resposta =
      `(modo simulado) Recebi sua mensagem: "${pergunta}". ` +
      'Para respostas de verdade, configure IA_PROVEDOR=ollama ou anthropic no .env.';

    for (const pedaco of resposta.match(/\S+\s*/g) ?? []) {
      sinal.throwIfAborted();
      aoTexto(pedaco);
      if (this.pausaMs) await esperar(this.pausaMs);
    }
    return { conteudo: [{ type: 'text', text: resposta }] };
  }
}
