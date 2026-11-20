/** Formatos que a API devolve (ver api/src). Datas chegam como texto ISO. */

export interface Empresa {
  id: string;
  slug: string;
  nome: string;
  nomeBot: string;
  tom: string;
  instrucoes: string;
  conhecimento: string;
  mensagemBoasVindas: string;
  corPrimaria: string;
  sugestoes: string[];
  criadoEm: string;
  atualizadoEm: string;
}

/** Campos que o painel edita (PATCH /api/painel/empresa). */
export type DadosBot = Pick<
  Empresa,
  | 'nomeBot'
  | 'tom'
  | 'instrucoes'
  | 'conhecimento'
  | 'mensagemBoasVindas'
  | 'corPrimaria'
  | 'sugestoes'
>;

export interface Usuario {
  id: string;
  nome: string;
  email: string;
}

export interface Login {
  token: string;
  expiraEm: string;
  usuario: Usuario;
  empresa: Empresa;
}

export interface Lead {
  id: string;
  conversaId: string;
  nome: string;
  contato: string;
  tipoContato: 'email' | 'telefone';
  interesse: string;
  criadoEm: string;
  atualizadoEm: string;
}

/** Limites iguais aos da API (api/src/empresas/dados-empresa.ts). */
export const LIMITES = {
  nomeBot: 60,
  tom: 500,
  instrucoes: 5_000,
  conhecimento: 100_000,
  mensagemBoasVindas: 500,
  sugestoes: 4,
  caracteresSugestao: 40,
} as const;
