import { randomUUID } from 'node:crypto';
import { setTimeout as esperar } from 'node:timers/promises';
import {
  executarChamadas,
  type MensagemIa,
  type PedidoIa,
  type ProvedorIa,
  type RespostaIa,
  textoDosBlocos,
} from './provedor-ia.js';

const CONTATO =
  /[\w.+-]+@[\w-]+\.[\w.]+|(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/;
const NOME =
  /(?:meu nome é|me chamo|aqui é (?:o|a)?|sou (?:o|a))\s+([A-ZÀ-Ú][\wÀ-ú]+(?:\s+[A-ZÀ-Ú][\wÀ-ú]+)?)/i;
const INTERESSE =
  /encomend|comprar|orçamento|pedido|contrat|quero|preço|valor/i;

/**
 * IA de mentira: custo zero, nada para instalar. Serve para desenvolver o resto
 * do produto (widget, leads, painel) e para a demo pública do portfólio.
 * Responde em pedaços, com pausa, para exercitar o streaming de verdade, e
 * imita a captura de lead: se a mensagem tem telefone ou e-mail, chama `salvar_lead`.
 */
export class ProvedorSimulado implements ProvedorIa {
  readonly nome = 'simulado';

  constructor(private readonly pausaMs = 40) {}

  async responder({
    mensagens,
    ferramentas = [],
    aoTexto,
    sinal,
  }: PedidoIa): Promise<RespostaIa> {
    const ultima = mensagens.at(-1);
    const pergunta = ultima ? textoDosBlocos(ultima.conteudo).trim() : '';
    const novas: MensagemIa[] = [];

    const contato = pergunta.match(CONTATO)?.[0];
    const salvarLead = ferramentas.find((f) => f.nome === 'salvar_lead');
    let resposta: string;

    if (contato && salvarLead) {
      const chamada = {
        type: 'tool_use',
        id: `simulado_${randomUUID()}`,
        name: 'salvar_lead',
        input: {
          nome: pergunta.match(NOME)?.[1] ?? 'Visitante',
          contato,
          interesse: pergunta.slice(0, 200),
        },
      };
      novas.push({ papel: 'assistant', conteudo: [chamada] });
      const resultado = await executarChamadas(
        [{ id: chamada.id, nome: chamada.name, entrada: chamada.input }],
        ferramentas,
      );
      novas.push(resultado);
      const deuErro = (resultado.conteudo[0] as { is_error?: boolean })
        .is_error;
      resposta = deuErro
        ? '(modo simulado) Não consegui anotar esse contato. Pode mandar nome e telefone com DDD, ou um e-mail?'
        : `(modo simulado) Anotei seu contato (${contato}). Nossa equipe vai falar com você em breve!`;
    } else if (salvarLead && INTERESSE.test(pergunta)) {
      resposta =
        '(modo simulado) Posso pedir para nossa equipe falar com você. Qual é o seu nome e um telefone ou e-mail?';
    } else {
      resposta =
        `(modo simulado) Recebi sua mensagem: "${pergunta}". ` +
        'Para respostas de verdade, configure IA_PROVEDOR=ollama ou anthropic no .env.';
    }

    for (const pedaco of resposta.match(/\S+\s*/g) ?? []) {
      sinal.throwIfAborted();
      aoTexto(pedaco);
      if (this.pausaMs) await esperar(this.pausaMs);
    }
    novas.push({
      papel: 'assistant',
      conteudo: [{ type: 'text', text: resposta }],
    });
    return { mensagens: novas };
  }
}
