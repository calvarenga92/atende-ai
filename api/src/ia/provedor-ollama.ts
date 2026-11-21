import { randomUUID } from 'node:crypto';
import {
  chamadasDosBlocos,
  executarChamadas,
  type FerramentaIa,
  MAX_RODADAS_FERRAMENTA,
  type MensagemIa,
  type PedidoIa,
  type ProvedorIa,
  type RespostaIa,
  resultadosDosBlocos,
  separadorDeRodadas,
  sistemaCompleto,
  textoDosBlocos,
} from './provedor-ia.js';

interface ChamadaOllama {
  id?: string;
  function: { name: string; arguments: unknown };
}

interface MensagemOllama {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ChamadaOllama[];
  tool_name?: string;
}

/** Uma linha do stream NDJSON de POST /api/chat do Ollama. */
interface LinhaOllama {
  message?: { content?: string; tool_calls?: ChamadaOllama[] };
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
    private readonly contexto: number,
  ) {
    this.nome = `ollama (${modelo})`;
  }

  async responder(pedido: PedidoIa): Promise<RespostaIa> {
    const { mensagens, ferramentas = [], aoTexto, sinal } = pedido;
    const historico: MensagemOllama[] = [
      { role: 'system', content: sistemaCompleto(pedido) },
      ...paraOllama(mensagens),
    ];
    const novas: MensagemIa[] = [];
    const saida = separadorDeRodadas(aoTexto);
    let entrada = 0;
    let gerados = 0;
    let duracao = 0;

    for (let rodada = 1; ; rodada++) {
      saida.novaRodada();
      const r = await this.rodada(historico, ferramentas, saida.aoTexto, sinal);
      entrada += r.final?.prompt_eval_count ?? 0;
      gerados += r.final?.eval_count ?? 0;
      duracao += r.final?.total_duration ?? 0;

      const chamadas = r.chamadas.map((c) => ({
        type: 'tool_use',
        id: c.id ?? `ollama_${randomUUID()}`,
        name: c.function.name,
        input: c.function.arguments,
      }));
      const conteudo: unknown[] = [
        ...(r.texto ? [{ type: 'text', text: r.texto }] : []),
        ...chamadas,
      ];
      novas.push({ papel: 'assistant', conteudo });
      historico.push({
        role: 'assistant',
        content: r.texto,
        ...(r.chamadas.length ? { tool_calls: r.chamadas } : {}),
      });

      if (!chamadas.length) break;

      // Todo pedido de ferramenta precisa de resultado no histórico, mesmo na última rodada.
      const resultado = await executarChamadas(
        chamadasDosBlocos(conteudo),
        ferramentas,
      );
      novas.push(resultado);
      historico.push(...paraOllama([resultado], conteudo));
      if (rodada >= MAX_RODADAS_FERRAMENTA) break;
    }

    return {
      mensagens: novas,
      consumo: `entrada ${entrada}, saída ${gerados} tokens em ${(duracao / 1e9).toFixed(1)}s (local, sem custo)`,
    };
  }

  private async rodada(
    historico: MensagemOllama[],
    ferramentas: FerramentaIa[],
    aoTexto: (pedaco: string) => void,
    sinal: AbortSignal,
  ) {
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
          // O padrão do Ollama é 4096 tokens: o que passar disso (base de conhecimento
          // grande, conversa longa) é cortado sem aviso. Sobe para caber a base inteira.
          options: { num_ctx: this.contexto },
          // Modelo só fica na memória enquanto o chat está em uso: sai 5 min depois da
          // última mensagem (ocupa ~10 GB de VRAM com este contexto). A volta custa uns segundos.
          keep_alive: '5m',
          tools: ferramentas.map((f) => ({
            type: 'function',
            function: {
              name: f.nome,
              description: f.descricao,
              parameters: f.parametros,
            },
          })),
          messages: historico,
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
    const chamadas: ChamadaOllama[] = [];
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
        chamadas.push(...(dado.message?.tool_calls ?? []));
        if (dado.done) final = dado;
      }
    }
    return { texto, chamadas, final };
  }
}

/**
 * Converte o histórico em blocos para o formato do Ollama.
 * `anteriores` ajuda a achar o nome da ferramenta de cada resultado.
 */
export function paraOllama(
  mensagens: MensagemIa[],
  anteriores: unknown[] = [],
): MensagemOllama[] {
  const nomePorId = new Map(
    chamadasDosBlocos(anteriores).map((c) => [c.id, c.nome]),
  );
  const saida: MensagemOllama[] = [];

  for (const m of mensagens) {
    const texto = textoDosBlocos(m.conteudo);
    if (m.papel === 'assistant') {
      const chamadas = chamadasDosBlocos(m.conteudo);
      for (const c of chamadas) nomePorId.set(c.id, c.nome);
      if (!texto && !chamadas.length) continue;
      saida.push({
        role: 'assistant',
        content: texto,
        ...(chamadas.length
          ? {
              tool_calls: chamadas.map((c) => ({
                id: c.id,
                function: { name: c.nome, arguments: c.entrada },
              })),
            }
          : {}),
      });
    } else {
      for (const r of resultadosDosBlocos(m.conteudo)) {
        saida.push({
          role: 'tool',
          content: r.texto,
          tool_name: nomePorId.get(r.idChamada) ?? '',
        });
      }
      if (texto) saida.push({ role: 'user', content: texto });
    }
  }
  return saida;
}
