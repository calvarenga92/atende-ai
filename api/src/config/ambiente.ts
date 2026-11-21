/**
 * Variáveis de ambiente lidas uma vez, na subida. Faltou algo obrigatório,
 * a aplicação nem sobe: melhor falhar no deploy do que na primeira requisição.
 */
export const PROVEDORES_IA = [
  'simulado',
  'ollama',
  'openai',
  'anthropic',
] as const;
export type ProvedorIaNome = (typeof PROVEDORES_IA)[number];

export const ESFORCOS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Esforco = (typeof ESFORCOS)[number];

export interface Ambiente {
  porta: number;
  urlBanco: string;
  origensCors: string[];
  ia: {
    provedor: ProvedorIaNome;
    ollama: { url: string; modelo: string; contexto: number };
    openai: { url: string; chave: string; modelo: string };
    anthropic: { modelo: string; esforco: Esforco };
  };
}

export function lerAmbiente(env: NodeJS.ProcessEnv = process.env): Ambiente {
  const urlBanco = env.DATABASE_URL?.trim();
  if (!urlBanco) {
    throw new Error('DATABASE_URL não definida. Veja o .env.example.');
  }

  const porta = Number(env.PORT ?? 3100);
  if (!Number.isInteger(porta) || porta <= 0) {
    throw new Error(`PORT inválida: "${env.PORT}".`);
  }

  const origensCors = (env.CORS_ORIGENS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (
    env.IA_PROVEDOR?.trim() === 'openai' &&
    !env.IA_CHAVE?.trim() &&
    !/127\.0\.0\.1|localhost/.test(env.IA_URL ?? '')
  ) {
    throw new Error(
      'IA_PROVEDOR=openai precisa de IA_CHAVE. Veja o .env.example.',
    );
  }

  return {
    porta,
    urlBanco,
    origensCors,
    ia: {
      provedor: umDe('IA_PROVEDOR', env.IA_PROVEDOR, PROVEDORES_IA, 'simulado'),
      ollama: {
        // 127.0.0.1, não localhost: no Windows o localhost tenta IPv6 antes e soma ~2 s por pedido.
        url: (env.OLLAMA_URL?.trim() || 'http://127.0.0.1:11434').replace(
          /\/$/,
          '',
        ),
        modelo: env.OLLAMA_MODELO?.trim() || 'qwen3:8b',
        contexto: inteiroPositivo(
          'OLLAMA_CONTEXTO',
          env.OLLAMA_CONTEXTO,
          32768,
        ),
      },
      // Formato de chat da OpenAI: Groq (padrão, plano grátis), Gemini, OpenRouter, Ollama /v1.
      openai: {
        url: (env.IA_URL?.trim() || 'https://api.groq.com/openai/v1').replace(
          /\/$/,
          '',
        ),
        chave: env.IA_CHAVE?.trim() ?? '',
        modelo: env.IA_MODELO?.trim() || 'llama-3.3-70b-versatile',
      },
      anthropic: {
        modelo: env.ANTHROPIC_MODELO?.trim() || 'claude-opus-5-5',
        esforco: umDe(
          'ANTHROPIC_ESFORCO',
          env.ANTHROPIC_ESFORCO,
          ESFORCOS,
          'low',
        ),
      },
    },
  };
}

function umDe<T extends string>(
  nome: string,
  valor: string | undefined,
  opcoes: readonly T[],
  padrao: T,
): T {
  const v = (valor?.trim() || padrao) as T;
  if (!opcoes.includes(v)) {
    throw new Error(`${nome} inválido: "${valor}". Use ${opcoes.join(' | ')}.`);
  }
  return v;
}

function inteiroPositivo(
  nome: string,
  valor: string | undefined,
  padrao: number,
): number {
  if (!valor?.trim()) return padrao;
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${nome} inválido: "${valor}". Use um inteiro positivo.`);
  }
  return n;
}
