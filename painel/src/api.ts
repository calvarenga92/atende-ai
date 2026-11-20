import type { DadosBot, Empresa, Lead, Login, Usuario } from './tipos';

export const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3100'
).replace(/\/$/, '');

/** Erro no formato da API: `{ codigo, mensagem, campos? }`. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly campos: Record<string, string> = {},
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

interface Opcoes {
  corpo?: unknown;
  token?: string | null;
}

export async function pedir<T>(
  metodo: string,
  rota: string,
  { corpo, token }: Opcoes = {},
): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${API_URL}/api${rota}`, {
      method: metodo,
      headers: {
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroApi(
      0,
      'SEM_CONEXAO',
      'Não foi possível falar com o servidor. Confira a conexão e tente de novo.',
    );
  }

  if (resposta.status === 204) return undefined as T;
  const dados: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const e = (dados ?? {}) as Partial<{
      codigo: string;
      mensagem: string;
      campos: Record<string, string>;
    }>;
    throw new ErroApi(
      resposta.status,
      e.codigo ?? 'ERRO_DESCONHECIDO',
      e.mensagem ?? 'Algo deu errado. Tente de novo.',
      e.campos,
    );
  }
  return dados as T;
}

export interface DadosCadastro {
  nome: string;
  email: string;
  senha: string;
  empresa: { nome: string; slug: string };
}

/** Rotas da API usadas pelo painel, num lugar só. */
export const api = {
  entrar: (email: string, senha: string) =>
    pedir<Login>('POST', '/auth/entrar', { corpo: { email, senha } }),
  cadastrar: (dados: DadosCadastro) =>
    pedir<Login>('POST', '/auth/cadastro', { corpo: dados }),
  sair: (token: string) => pedir<void>('POST', '/auth/sair', { token }),
  eu: (token: string) =>
    pedir<{ usuario: Usuario; empresa: Empresa }>('GET', '/auth/eu', {
      token,
    }),
  salvarBot: (token: string, dados: Partial<DadosBot>) =>
    pedir<Empresa>('PATCH', '/painel/empresa', { token, corpo: dados }),
  leads: (token: string) => pedir<Lead[]>('GET', '/painel/leads', { token }),
};
