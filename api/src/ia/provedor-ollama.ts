import {
  type PedidoIa,
  type ProvedorIa,
  type RespostaIa,
  textoDosBlocos,
} from './provedor-ia.js';

/** Uma linha do stream NDJSON de POST /api/chat do Ollama. */
interface LinhaOllama {
  message?: { content?: string };
  done?: boolean;
  error?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
}

/**
 * IA local e gratuita via Ollama (https://ollama.com), rodando na placa de vídeo.
 * Fala com a API REST nativa do Ollama em streaming (uma linha JSON por pedaço).
 */
export class ProvedorOllama implements ProvedorIa {
  readonly nome: string;

  constructor(
    private readonly url: string,
    private readonly modelo: string,
  ) {
    this.nome = `ollama (${modelo})`;
  }

  async responder({
    sistema,
    mensagens,
    aoTexto,
    sinal,
  }: PedidoIa): Promise<RespostaIa> {
    let resposta: Response;
    try {
      resposta = await fetch(`${this.url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: sinal,
        body: JSON.stringify({
          model: this.modelo,
          stream: true,
          // Modelos com "modo raciocínio" (qwen3...) respondem bem mais rápido sem ele,
          // e para atendimento de FAQ não faz falta.
          think: false,
          messages: [
            { role: 'system', content: sistema },
            ...mensagens.map((m) => ({
              role: m.papel,
              content: textoDosBlocos(m.conteudo),
            })),
          ],
        }),
      });
    } catch (erro) {
      if (sinal.aborted) throw erro;
      throw new Error(
        `Ollama não respondeu em ${this.url}. Ele está aberto? (ícone na bandeja do Windows)`,
        { cause: erro },
      );
    }

    if (!resposta.ok || !resposta.body) {
      const detalhe = await resposta.text().catch(() => '');
      throw new Error(`Ollama respondeu ${resposta.status}: ${detalhe}`);
    }

    let texto = '';
    let final: LinhaOllama | undefined;
    let buffer = '';
    const decodificador = new TextDecoder();

    for await (const bytes of resposta.body) {
      buffer += decodificador.decode(bytes, { stream: true });
      const linhas = buffer.split('\n');
      buffer = linhas.pop() ?? '';
      for (const linha of linhas) {
        if (!linha.trim()) continue;
        const dado = JSON.parse(linha) as LinhaOllama;
        if (dado.error) throw new Error(`Ollama: ${dado.error}`);
        const pedaco = dado.message?.content ?? '';
        if (pedaco) {
          texto += pedaco;
          aoTexto(pedaco);
        }
        if (dado.done) final = dado;
      }
    }

    const segundos = final?.total_duration
      ? (final.total_duration / 1e9).toFixed(1)
      : '?';
    return {
      conteudo: [{ type: 'text', text: texto }],
      consumo: `entrada ${final?.prompt_eval_count ?? '?'}, saída ${final?.eval_count ?? '?'} tokens em ${segundos}s (local, sem custo)`,
    };
  }
}
