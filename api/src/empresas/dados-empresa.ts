import { dadosInvalidos } from '../comum/erro-aplicacao.js';
import type { Empresa } from './empresa.entity.js';

export type DadosEmpresa = Pick<
  Empresa,
  | 'slug'
  | 'nome'
  | 'nomeBot'
  | 'tom'
  | 'instrucoes'
  | 'conhecimento'
  | 'mensagemBoasVindas'
  | 'corPrimaria'
  | 'sugestoes'
>;

type CampoTexto = Exclude<keyof DadosEmpresa, 'sugestoes'>;

export const MAX_SUGESTOES = 4;
export const MAX_CARACTERES_SUGESTAO = 40;

const LIMITES: Record<CampoTexto, number> = {
  slug: 60,
  nome: 120,
  nomeBot: 60,
  tom: 500,
  instrucoes: 5_000,
  // ~100 mil caracteres ≈ 25 mil tokens: cabe no prompt com cache. Acima disso, busca (RAG).
  conhecimento: 100_000,
  mensagemBoasVindas: 500,
  corPrimaria: 7,
};
const OBRIGATORIOS: CampoTexto[] = [
  'slug',
  'nome',
  'nomeBot',
  'tom',
  'mensagemBoasVindas',
];

/**
 * Valida o corpo de criação (parcial = false) ou edição (parcial = true).
 * Devolve só os campos conhecidos, já aparados.
 */
export function validarDadosEmpresa(
  corpo: unknown,
  parcial: boolean,
): Partial<DadosEmpresa> {
  if (typeof corpo !== 'object' || corpo === null) {
    throw dadosInvalidos({ corpo: 'Envie um objeto JSON.' });
  }
  const entrada = corpo as Record<string, unknown>;
  const saida: Partial<DadosEmpresa> = {};
  const erros: Record<string, string> = {};

  for (const campo of Object.keys(LIMITES) as CampoTexto[]) {
    const valor = entrada[campo];
    if (valor === undefined) {
      if (!parcial && OBRIGATORIOS.includes(campo))
        erros[campo] = 'Obrigatório.';
      continue;
    }
    if (typeof valor !== 'string') {
      erros[campo] = 'Deve ser texto.';
      continue;
    }
    const texto = valor.trim();
    if (OBRIGATORIOS.includes(campo) && !texto) erros[campo] = 'Obrigatório.';
    else if (texto.length > LIMITES[campo])
      erros[campo] = `Máximo de ${LIMITES[campo]} caracteres.`;
    else saida[campo] = texto;
  }

  if (
    saida.slug !== undefined &&
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(saida.slug)
  ) {
    erros.slug =
      'Use letras minúsculas, números e hífen (ex.: padaria-centro).';
  }
  if (
    saida.corPrimaria !== undefined &&
    !/^#[0-9a-fA-F]{6}$/.test(saida.corPrimaria)
  ) {
    erros.corPrimaria = 'Use o formato #RRGGBB.';
  }

  if (entrada.sugestoes !== undefined) {
    const sugestoes = validarSugestoes(entrada.sugestoes);
    if (typeof sugestoes === 'string') erros.sugestoes = sugestoes;
    else saida.sugestoes = sugestoes;
  }

  if (Object.keys(erros).length) throw dadosInvalidos(erros);
  return saida;
}

/** Lista de atalhos do widget: textos curtos, sem repetição. Devolve a mensagem de erro, se houver. */
function validarSugestoes(valor: unknown): string[] | string {
  if (!Array.isArray(valor) || valor.some((s) => typeof s !== 'string')) {
    return 'Envie uma lista de textos.';
  }
  const limpas = [
    ...new Set((valor as string[]).map((s) => s.trim()).filter(Boolean)),
  ];
  if (limpas.length > MAX_SUGESTOES) {
    return `No máximo ${MAX_SUGESTOES} sugestões.`;
  }
  if (limpas.some((s) => s.length > MAX_CARACTERES_SUGESTAO)) {
    return `Cada sugestão tem no máximo ${MAX_CARACTERES_SUGESTAO} caracteres.`;
  }
  return limpas;
}
