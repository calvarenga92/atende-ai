/**
 * Contrato entre o chat e qualquer IA (simulada, Ollama local ou Claude).
 *
 * O formato das mensagens é o de blocos de conteúdo (`{ type: 'text', text }`),
 * o mesmo da API da Anthropic. Cada provedor converte para o que precisa e
 * ignora blocos que não entende (ex.: o Ollama ignora blocos de thinking da Claude).
 */
export interface MensagemIa {
  papel: 'user' | 'assistant';
  conteudo: unknown[];
}

export interface PedidoIa {
  sistema: string;
  mensagens: MensagemIa[];
  /** Chamado a cada pedaço de texto gerado, para o streaming. */
  aoTexto: (pedaco: string) => void;
  sinal: AbortSignal;
}

export interface RespostaIa {
  /** Blocos a guardar no histórico, exatamente como devem voltar na próxima rodada. */
  conteudo: unknown[];
  /** A IA se recusou a responder por política de segurança. */
  recusou?: boolean;
  /** Linha de consumo para o log (tokens, tempo...). */
  consumo?: string;
}

export interface ProvedorIa {
  readonly nome: string;
  responder(pedido: PedidoIa): Promise<RespostaIa>;
}

export const PROVEDOR_IA = Symbol('PROVEDOR_IA');

/** Junta o texto dos blocos `text` de uma mensagem. */
export function textoDosBlocos(conteudo: unknown[]): string {
  return conteudo
    .filter(
      (b): b is { type: 'text'; text: string } =>
        typeof b === 'object' &&
        b !== null &&
        (b as { type?: unknown }).type === 'text' &&
        typeof (b as { text?: unknown }).text === 'string',
    )
    .map((b) => b.text)
    .join('');
}
