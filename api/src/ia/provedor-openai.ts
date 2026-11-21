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

interface ChamadaOpenAi {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface MensagemOpenAi {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ChamadaOpenAi[];
  tool_call_id?: string;
}

/** Um evento `data:` do streaming de POST /chat/completions. */
interface PedacoOpenAi {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: {
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  error?: { message?: string };
}

/**
 * Qualquer API no formato de chat da OpenAI (POST /chat/completions em streaming):
 * Groq, Gemini, OpenRouter e o próprio Ollama (/v1). É o que roda em produção,
 * num plano gratuito, sem custo.
 */
export class ProvedorOpenAi implements ProvedorIa {
  readonly nome: string;

  constructor(
    private readonly url: string,
    private readonly chave: string,
    private readonly modelo: string,
    /** Modelos de reserva (cota separada no Groq), usados quando o principal estoura o limite. */
    private readonly reservas: string[] = [],
  ) {
    this.nome = `openai-compatível (${[modelo, ...reservas].join(' → ')} em ${new URL(url).host})`;
  }

  async responder(pedido: PedidoIa): Promise<RespostaIa> {
    const { mensagens, ferramentas = [], aoTexto, sinal } = pedido;
    const historico: MensagemOpenAi[] = [
      { role: 'system', content: sistemaCompleto(pedido) },
      ...paraOpenAi(mensagens),
    ];
    const novas: MensagemIa[] = [];
    const saida = separadorDeRodadas(aoTexto);
    let entrada = 0;
    let gerados = 0;
    const usados = new Set<string>();

    for (let rodada = 1; ; rodada++) {
      saida.novaRodada();
      const r = await this.rodada(historico, ferramentas, saida.aoTexto, sinal);
      entrada += r.entrada;
      gerados += r.saida;
      usados.add(r.modelo);

      const chamadas = r.chamadas.map((c) => ({
        type: 'tool_use',
        id: c.id,
        name: c.function.name,
        input: lerJson(c.function.arguments),
      }));
      const conteudo: unknown[] = [
        ...(r.texto ? [{ type: 'text', text: r.texto }] : []),
        ...chamadas,
      ];
      novas.push({ papel: 'assistant', conteudo });
      historico.push({
        role: 'assistant',
        content: r.texto || null,
        ...(r.chamadas.length ? { tool_calls: r.chamadas } : {}),
      });

      if (!chamadas.length) break;

      // Todo pedido de ferramenta precisa de resultado no histórico, mesmo na última rodada.
      const resultado = await executarChamadas(
        chamadasDosBlocos(conteudo),
        ferramentas,
      );
      novas.push(resultado);
      historico.push(...paraOpenAi([resultado]));
      if (rodada >= MAX_RODADAS_FERRAMENTA) break;
    }

    return {
      mensagens: novas,
      consumo: `entrada ${entrada}, saída ${gerados} tokens (${[...usados].join(', ')})`,
    };
  }

  /**
   * Faz o pedido. No limite de uso (429), espera o que a API pedir (até
   * ESPERA_MAX_MS) e tenta de novo; se não der, passa para o modelo de reserva.
   */
  private async pedir(
    historico: MensagemOpenAi[],
    ferramentas: FerramentaIa[],
    sinal: AbortSignal,
  ): Promise<{
    resposta: Response & { body: ReadableStream<Uint8Array> };
    modelo: string;
  }> {
    let ultimo = '';
    for (const modelo of [this.modelo, ...this.reservas]) {
      for (let tentativa = 1; tentativa <= 2; tentativa++) {
        const resposta = await fetch(`${this.url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.chave ? { Authorization: `Bearer ${this.chave}` } : {}),
          },
          signal: sinal,
          body: JSON.stringify({
            model: modelo,
            stream: true,
            stream_options: { include_usage: true },
            // Atendimento pede resposta firme, não criativa.
            temperature: 0.3,
            max_tokens: 1024,
            ...(ferramentas.length
              ? {
                  tools: ferramentas.map((f) => ({
                    type: 'function',
                    function: {
                      name: f.nome,
                      description: f.descricao,
                      parameters: f.parametros,
                    },
                  })),
                }
              : {}),
            messages: historico,
          }),
        });
        if (resposta.ok && resposta.body) {
          return {
            resposta: resposta as Response & {
              body: ReadableStream<Uint8Array>;
            },
            modelo,
          };
        }
        const detalhe = await resposta.text().catch(() => '');
        if (resposta.status !== 429) {
          throw new Error(
            `IA respondeu ${resposta.status}: ${detalhe.slice(0, 300)}`,
          );
        }
        ultimo = detalhe.slice(0, 300);
        const espera = esperaPedida(resposta, detalhe);
        if (tentativa === 2 || espera > ESPERA_MAX_MS) break;
        await dormir(espera, sinal);
      }
    }
    throw new Error(`IA no limite de uso (429): ${ultimo}`);
  }

  private async rodada(
    historico: MensagemOpenAi[],
    ferramentas: FerramentaIa[],
    aoTexto: (pedaco: string) => void,
    sinal: AbortSignal,
  ) {
    const { resposta, modelo } = await this.pedir(
      historico,
      ferramentas,
      sinal,
    );

    let texto = '';
    const porIndice = new Map<number, ChamadaOpenAi>();
    let entrada = 0;
    let saida = 0;
    let buffer = '';
    const decodificador = new TextDecoder();

    const processar = (linha: string) => {
      if (!linha.startsWith('data:')) return;
      const dado = linha.slice(5).trim();
      if (!dado || dado === '[DONE]') return;
      const p = JSON.parse(dado) as PedacoOpenAi;
      if (p.error) throw new Error(`IA: ${p.error.message ?? 'erro'}`);
      if (p.usage) {
        entrada = p.usage.prompt_tokens ?? entrada;
        saida = p.usage.completion_tokens ?? saida;
      }
      const delta = p.choices?.[0]?.delta;
      if (!delta) return;
      if (delta.content) {
        texto += delta.content;
        aoTexto(delta.content);
      }
      for (const t of delta.tool_calls ?? []) {
        const atual = porIndice.get(t.index) ?? {
          id: '',
          type: 'function' as const,
          function: { name: '', arguments: '' },
        };
        if (t.id) atual.id = t.id;
        if (t.function?.name) atual.function.name += t.function.name;
        if (t.function?.arguments)
          atual.function.arguments += t.function.arguments;
        porIndice.set(t.index, atual);
      }
    };

    for await (const bytes of resposta.body) {
      buffer += decodificador.decode(bytes, { stream: true });
      const linhas = buffer.split('\n');
      buffer = linhas.pop() ?? '';
      for (const linha of linhas) processar(linha.trim());
    }
    processar(buffer.trim());

    const chamadas = [...porIndice.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, c]) => ({ ...c, id: c.id || `call_${randomUUID()}` }))
      .filter((c) => c.function.name);
    return { texto, chamadas, entrada, saida, modelo };
  }
}

/** Maior espera aceitável no limite de uso antes de trocar de modelo. */
const ESPERA_MAX_MS = 8_000;

/** Quanto a API pediu para esperar: cabeçalho retry-after ou "try again in 6.1s". */
export function esperaPedida(resposta: Response, detalhe: string): number {
  const cabecalho = Number(resposta.headers.get('retry-after'));
  if (Number.isFinite(cabecalho) && cabecalho > 0) return cabecalho * 1000;
  const m = /try again in ([\d.]+)\s*(ms|s)/i.exec(detalhe);
  if (m) return Math.ceil(Number(m[1]) * (m[2] === 'ms' ? 1 : 1000));
  return 2_000;
}

function dormir(ms: number, sinal: AbortSignal): Promise<void> {
  return new Promise((pronto, falha) => {
    const t = setTimeout(pronto, ms);
    sinal.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        falha(sinal.reason as Error);
      },
      { once: true },
    );
  });
}

function lerJson(texto: string): unknown {
  try {
    return texto.trim() ? JSON.parse(texto) : {};
  } catch {
    // Argumento quebrado vai como veio: a ferramenta valida e devolve o erro para a IA.
    return { argumentosInvalidos: texto };
  }
}

/** Converte o histórico em blocos para o formato de chat da OpenAI. */
export function paraOpenAi(mensagens: MensagemIa[]): MensagemOpenAi[] {
  const saida: MensagemOpenAi[] = [];
  for (const m of mensagens) {
    const texto = textoDosBlocos(m.conteudo);
    if (m.papel === 'assistant') {
      const chamadas = chamadasDosBlocos(m.conteudo);
      if (!texto && !chamadas.length) continue;
      saida.push({
        role: 'assistant',
        content: texto || null,
        ...(chamadas.length
          ? {
              tool_calls: chamadas.map((c) => ({
                id: c.id,
                type: 'function' as const,
                function: {
                  name: c.nome,
                  arguments: JSON.stringify(c.entrada ?? {}),
                },
              })),
            }
          : {}),
      });
    } else {
      for (const r of resultadosDosBlocos(m.conteudo)) {
        saida.push({
          role: 'tool',
          content: r.texto,
          tool_call_id: r.idChamada,
        });
      }
      if (texto) saida.push({ role: 'user', content: texto });
    }
  }
  return saida;
}
