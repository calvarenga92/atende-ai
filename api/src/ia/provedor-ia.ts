/**
 * Contrato entre o chat e qualquer IA (simulada, Ollama local ou Anthropic).
 *
 * O formato das mensagens é o de blocos de conteúdo, o mesmo da API da Anthropic:
 * - `{ type: 'text', text }`
 * - `{ type: 'tool_use', id, name, input }` (assistente pediu uma ferramenta)
 * - `{ type: 'tool_result', tool_use_id, content, is_error? }` (resultado, numa mensagem `user`)
 * Cada provedor converte para o formato dele e ignora blocos que não entende
 * (ex.: o Ollama ignora blocos de thinking).
 */
export interface MensagemIa {
  papel: 'user' | 'assistant';
  conteudo: unknown[];
}

/** Resultado de uma ferramenta, já em texto para a IA ler. */
export interface ResultadoFerramenta {
  texto: string;
  erro?: boolean;
}

/** Ferramenta que a IA pode chamar. Quem executa valida a entrada: ela vem do modelo. */
export interface FerramentaIa {
  nome: string;
  descricao: string;
  /** JSON Schema (objeto) dos parâmetros. */
  parametros: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  executar(entrada: unknown): Promise<ResultadoFerramenta>;
}

export interface PedidoIa {
  sistema: string;
  /**
   * Contexto que muda a cada pedido (data de hoje). Fica fora do `sistema`
   * para não quebrar o cache do prompt; cada provedor anexa do seu jeito.
   */
  contexto?: string;
  mensagens: MensagemIa[];
  ferramentas?: FerramentaIa[];
  /** Chamado a cada pedaço de texto gerado, para o streaming. */
  aoTexto: (pedaco: string) => void;
  sinal: AbortSignal;
}

export interface RespostaIa {
  /**
   * Mensagens novas desta rodada, em ordem, para guardar no histórico:
   * a resposta final e, se houve ferramenta, o pedido e o resultado antes dela.
   */
  mensagens: MensagemIa[];
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

/** Quantas idas e vindas com ferramenta, no máximo, numa resposta. */
export const MAX_RODADAS_FERRAMENTA = 4;

type Bloco = { type?: unknown; [k: string]: unknown };

function blocos(conteudo: unknown[]): Bloco[] {
  return conteudo.filter(
    (b): b is Bloco => typeof b === 'object' && b !== null,
  );
}

/** Junta o texto dos blocos `text` de uma mensagem. */
export function textoDosBlocos(conteudo: unknown[]): string {
  return blocos(conteudo)
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('');
}

export interface ChamadaFerramenta {
  id: string;
  nome: string;
  entrada: unknown;
}

export function chamadasDosBlocos(conteudo: unknown[]): ChamadaFerramenta[] {
  return blocos(conteudo)
    .filter((b) => b.type === 'tool_use' && typeof b.id === 'string')
    .map((b) => ({
      id: b.id as string,
      nome: String(b.name),
      entrada: b.input,
    }));
}

export function resultadosDosBlocos(
  conteudo: unknown[],
): { idChamada: string; texto: string }[] {
  return blocos(conteudo)
    .filter(
      (b) => b.type === 'tool_result' && typeof b.tool_use_id === 'string',
    )
    .map((b) => ({
      idChamada: b.tool_use_id as string,
      texto:
        typeof b.content === 'string' ? b.content : JSON.stringify(b.content),
    }));
}

/** Executa as chamadas e monta a mensagem `user` com os resultados. */
export async function executarChamadas(
  chamadas: ChamadaFerramenta[],
  ferramentas: FerramentaIa[],
): Promise<MensagemIa> {
  const conteudo: unknown[] = [];
  for (const c of chamadas) {
    const f = ferramentas.find((x) => x.nome === c.nome);
    const r: ResultadoFerramenta = f
      ? await f.executar(c.entrada)
      : { texto: `Ferramenta "${c.nome}" não existe.`, erro: true };
    conteudo.push({
      type: 'tool_result',
      tool_use_id: c.id,
      content: r.texto,
      ...(r.erro ? { is_error: true } : {}),
    });
  }
  return { papel: 'user', conteudo };
}

/**
 * Embrulha o `aoTexto` para separar com quebra de linha o texto de rodadas
 * diferentes ("Vou anotar." + ferramenta + "Pronto!"), que senão sairiam colados.
 */
export function separadorDeRodadas(aoTexto: (pedaco: string) => void) {
  let emitiu = false;
  let pendente = false;
  return {
    novaRodada: () => {
      if (emitiu) pendente = true;
    },
    aoTexto: (pedaco: string) => {
      if (!pedaco) return;
      if (pendente) {
        aoTexto('\n\n');
        pendente = false;
      }
      emitiu = true;
      aoTexto(pedaco);
    },
  };
}

/** Prompt de sistema + contexto do pedido, para provedores sem blocos de sistema. */
export function sistemaCompleto({ sistema, contexto }: PedidoIa): string {
  return contexto
    ? `${sistema}

${contexto}`
    : sistema;
}
