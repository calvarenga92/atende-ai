export interface DadosLead {
  nome: string;
  /** E-mail em minúsculas ou telefone só com dígitos (com DDD). */
  contato: string;
  tipoContato: 'email' | 'telefone';
  interesse: string;
}

export type ValidacaoLead =
  { ok: true; dados: DadosLead } | { ok: false; problemas: string[] };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida o que a IA mandou para `salvar_lead`. A entrada vem do modelo, então
 * pode faltar campo, vir tipo errado ou contato inventado pela metade.
 * Os problemas voltam em texto para a própria IA corrigir (pedir de novo ao visitante).
 */
export function validarLead(entrada: unknown): ValidacaoLead {
  const e = (
    typeof entrada === 'object' && entrada !== null ? entrada : {}
  ) as Record<string, unknown>;
  const problemas: string[] = [];

  const nome =
    typeof e.nome === 'string' ? e.nome.trim().replace(/\s+/g, ' ') : '';
  if (nome.length < 2) problemas.push('falta o nome da pessoa');
  else if (nome.length > 120) problemas.push('nome longo demais');

  const bruto = typeof e.contato === 'string' ? e.contato.trim() : '';
  let contato = '';
  let tipoContato: DadosLead['tipoContato'] = 'telefone';
  if (EMAIL.test(bruto)) {
    contato = bruto.toLowerCase();
    tipoContato = 'email';
  } else {
    let digitos = bruto.replace(/\D/g, '');
    if (digitos.length >= 12 && digitos.startsWith('55'))
      digitos = digitos.slice(2);
    if (digitos.length === 10 || digitos.length === 11) contato = digitos;
  }
  if (!contato) {
    problemas.push(
      bruto
        ? `contato "${bruto}" não parece um telefone com DDD nem um e-mail`
        : 'falta o contato (telefone com DDD ou e-mail)',
    );
  }

  const interesse =
    typeof e.interesse === 'string' ? e.interesse.trim().slice(0, 500) : '';

  if (problemas.length) return { ok: false, problemas };
  return { ok: true, dados: { nome, contato, tipoContato, interesse } };
}
