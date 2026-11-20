import type { Lead } from './tipos';

/** "11977771234" → "(11) 97777-1234". E-mail e formatos desconhecidos passam como vieram. */
export function formatarContato(lead: Pick<Lead, 'contato' | 'tipoContato'>) {
  if (lead.tipoContato !== 'telefone') return lead.contato;
  const d = lead.contato.replace(/\D/g, '');
  const m =
    d.length === 11
      ? /^(\d{2})(\d{5})(\d{4})$/.exec(d)
      : d.length === 10
        ? /^(\d{2})(\d{4})(\d{4})$/.exec(d)
        : null;
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : lead.contato;
}

/** "hoje, 14:32", "ontem, 17:20" ou "15/11". */
export function quando(iso: string, agora = new Date()): string {
  const data = new Date(iso);
  const hora = data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dia = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((dia(agora) - dia(data)) / 86_400_000);
  if (dias === 0) return `hoje, ${hora}`;
  if (dias === 1) return `ontem, ${hora}`;
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(data.getFullYear() !== agora.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function ehHoje(iso: string, agora = new Date()): boolean {
  return new Date(iso).toDateString() === agora.toDateString();
}

export type FiltroLeads = 'todos' | 'telefone' | 'email';

export function filtrarLeads(
  leads: Lead[],
  filtro: FiltroLeads,
  busca: string,
): Lead[] {
  const termo = semAcento(busca.trim().toLowerCase());
  const digitos = busca.replace(/\D/g, '');
  return leads.filter((l) => {
    if (filtro !== 'todos' && l.tipoContato !== filtro) return false;
    if (!termo) return true;
    return (
      semAcento(l.nome.toLowerCase()).includes(termo) ||
      semAcento(l.interesse.toLowerCase()).includes(termo) ||
      l.contato.toLowerCase().includes(termo) ||
      (digitos.length >= 3 && l.contato.includes(digitos))
    );
  });
}

/**
 * CSV para abrir no Excel em português: separador ";" e BOM (senão o acento quebra).
 * Campo que começa com = + - @ ganha um apóstrofo: evita fórmula injetada pelo visitante.
 */
export function leadsParaCsv(leads: Lead[]): string {
  const celula = (v: string) => {
    const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${seguro.replace(/"/g, '""')}"`;
  };
  const linhas = [
    ['Nome', 'Contato', 'Tipo', 'Interesse', 'Data'],
    ...leads.map((l) => [
      l.nome,
      formatarContato(l),
      l.tipoContato === 'telefone' ? 'telefone' : 'e-mail',
      l.interesse,
      new Date(l.criadoEm).toLocaleString('pt-BR'),
    ]),
  ];
  return '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n');
}

/** "Padaria Pão de Ouro" → "padaria-pao-de-ouro" (mesma regra que a API aceita). */
export function gerarSlug(nome: string): string {
  return semAcento(nome.toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Inicial para o avatar e uma cor estável por nome (todas com contraste AA para letra branca). */
const CORES_AVATAR = [
  '#be185d',
  '#7c3aed',
  '#0e7490',
  '#b45309',
  '#047857',
  '#4f46e5',
];
export function avatar(nome: string) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return {
    letra: (nome.trim()[0] ?? '?').toUpperCase(),
    cor: CORES_AVATAR[h % CORES_AVATAR.length],
  };
}
