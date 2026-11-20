import type { Lead } from './tipos';
import {
  avatar,
  filtrarLeads,
  formatarContato,
  gerarSlug,
  leadsParaCsv,
  quando,
} from './util';

function lead(d: Partial<Lead>): Lead {
  return {
    id: '1',
    conversaId: 'c1',
    nome: 'Mariana Costa',
    contato: '11977771234',
    tipoContato: 'telefone',
    interesse: 'Bolo de prestígio para sábado',
    criadoEm: '2026-11-20T14:32:00',
    atualizadoEm: '2026-11-20T14:32:00',
    ...d,
  };
}

describe('formatarContato', () => {
  it('formata celular e fixo, e deixa e-mail como veio', () => {
    expect(formatarContato(lead({}))).toBe('(11) 97777-1234');
    expect(formatarContato(lead({ contato: '1133334444' }))).toBe(
      '(11) 3333-4444',
    );
    expect(
      formatarContato(lead({ tipoContato: 'email', contato: 'a@b.com' })),
    ).toBe('a@b.com');
    expect(formatarContato(lead({ contato: '123' }))).toBe('123');
  });
});

describe('quando', () => {
  const agora = new Date('2026-11-20T18:00:00');
  it('hoje, ontem ou a data', () => {
    expect(quando('2026-11-20T14:32:00', agora)).toBe('hoje, 14:32');
    expect(quando('2026-11-19T23:10:00', agora)).toBe('ontem, 23:10');
    expect(quando('2026-11-15T09:00:00', agora)).toBe('15/11');
    expect(quando('2025-11-15T09:00:00', agora)).toBe('15/11/2025');
  });
});

describe('filtrarLeads', () => {
  const leads = [
    lead({ id: '1' }),
    lead({
      id: '2',
      nome: 'João Pereira',
      tipoContato: 'email',
      contato: 'joao@x.com',
      interesse: 'Salgados para 40 pessoas',
    }),
  ];

  it('filtra por tipo', () => {
    expect(filtrarLeads(leads, 'email', '').map((l) => l.id)).toEqual(['2']);
    expect(filtrarLeads(leads, 'telefone', '').map((l) => l.id)).toEqual(['1']);
  });

  it('busca no nome sem ligar para acento, no interesse e no telefone formatado', () => {
    expect(filtrarLeads(leads, 'todos', 'joao').map((l) => l.id)).toEqual([
      '2',
    ]);
    expect(filtrarLeads(leads, 'todos', 'PRESTIGIO').map((l) => l.id)).toEqual([
      '1',
    ]);
    expect(filtrarLeads(leads, 'todos', '97777-1').map((l) => l.id)).toEqual([
      '1',
    ]);
  });
});

describe('leadsParaCsv', () => {
  it('abre certo no Excel em português e não deixa fórmula passar', () => {
    const csv = leadsParaCsv([
      lead({ nome: '=HYPERLINK("x")', interesse: 'diz "oi"; tchau' }),
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    const [cab, linha] = csv.slice(1).split('\r\n');
    expect(cab).toBe('"Nome";"Contato";"Tipo";"Interesse";"Data"');
    expect(linha).toContain(`"'=HYPERLINK(""x"")"`);
    expect(linha).toContain('"(11) 97777-1234"');
    expect(linha).toContain('"diz ""oi""; tchau"');
  });
});

describe('gerarSlug', () => {
  it('segue a regra da API', () => {
    expect(gerarSlug('Padaria Pão de Ouro')).toBe('padaria-pao-de-ouro');
    expect(gerarSlug('  Café & Cia.  ')).toBe('cafe-cia');
    expect(gerarSlug('---')).toBe('');
    expect(gerarSlug('a'.repeat(59) + ' b')).toBe('a'.repeat(59));
  });
});

describe('avatar', () => {
  it('letra maiúscula e cor estável', () => {
    expect(avatar('mariana')).toEqual(avatar('mariana'));
    expect(avatar('mariana').letra).toBe('M');
  });
});
