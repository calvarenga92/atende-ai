import { validarLead } from './dados-lead.js';

describe('validarLead', () => {
  it('normaliza telefone brasileiro para só dígitos com DDD', () => {
    for (const contato of [
      '(11) 98888-7777',
      '11 98888 7777',
      '+55 11 98888-7777',
    ]) {
      const r = validarLead({ nome: 'Ana', contato });
      expect(r).toEqual({
        ok: true,
        dados: {
          nome: 'Ana',
          contato: '11988887777',
          tipoContato: 'telefone',
          interesse: '',
        },
      });
    }
  });

  it('aceita fixo com DDD e e-mail (em minúsculas)', () => {
    expect(validarLead({ nome: 'Ana', contato: '11 3333-4444' })).toMatchObject(
      {
        ok: true,
        dados: { contato: '1133334444' },
      },
    );
    expect(
      validarLead({ nome: 'Ana', contato: 'Ana@Exemplo.com' }),
    ).toMatchObject({
      ok: true,
      dados: { contato: 'ana@exemplo.com', tipoContato: 'email' },
    });
  });

  it('recusa telefone sem DDD, contato vazio e nome ausente', () => {
    const r = validarLead({ contato: '98888-7777' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problemas).toContain('falta o nome da pessoa');
      expect(r.problemas.join()).toMatch(/não parece um telefone/);
    }
    expect(validarLead({ nome: 'Ana' }).ok).toBe(false);
    expect(validarLead(null).ok).toBe(false);
  });

  it('limpa espaços do nome e corta interesse longo', () => {
    const r = validarLead({
      nome: '  Ana   Souza ',
      contato: 'a@b.com',
      interesse: 'x'.repeat(900),
    });
    expect(r.ok && r.dados.nome).toBe('Ana Souza');
    expect(r.ok && r.dados.interesse.length).toBe(500);
  });
});
