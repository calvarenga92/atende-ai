/**
 * Variáveis de ambiente lidas uma vez, na subida. Faltou algo obrigatório,
 * a aplicação nem sobe: melhor falhar no deploy do que na primeira requisição.
 */
export const PROVEDORES_IA = ['simulado', 'ollama', 'anthropic'] as const;
export type ProvedorIaNome = (typeof PROVEDORES_IA)[number];

export const ESFORCOS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Esforco = (typeof ESFORCOS)[number];

export interface Ambiente {
  porta: number;
  urlBanco: string;
  origensCors: string[];
  ia: {
    provedor: ProvedorIaNome;
    ollama: { url: string; modelo: string };
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

  return {
    porta,
    urlBanco,
    origensCors,
    ia: {
      provedor: umDe('IA_PROVEDOR', env.IA_PROVEDOR, PROVEDORES_IA, 'simulado'),
      ollama: {
        url: (env.OLLAMA_URL?.trim() || 'http://localhost:11434').replace(
          /\/$/,
          '',
        ),
        modelo: env.OLLAMA_MODELO?.trim() || 'qwen3:8b',
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
