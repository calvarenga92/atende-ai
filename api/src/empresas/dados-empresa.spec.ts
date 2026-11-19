import { ErroAplicacao } from '../comum/erro-aplicacao.js';
import { validarDadosEmpresa } from './dados-empresa.js';

const valido = {
  slug: 'padaria-centro',
  nome: 'Padaria Centro',
  nomeBot: 'Lia',
  tom: 'simpático',
  mensagemBoasVindas: 'Oi!',
};

function camposComErro(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    return (e as ErroAplicacao).campos;
  }
  throw new Error('não lançou');
}

describe('validarDadosEmpresa', () => {
  it('aceita e apara um cadastro completo', () => {
    expect(
      validarDadosEmpresa({ ...valido, nome: '  Padaria Centro ' }, false).nome,
    ).toBe('Padaria Centro');
  });

  it('aponta obrigatórios na criação, mas não na edição', () => {
    expect(camposComErro(() => validarDadosEmpresa({}, false))).toHaveProperty(
      'slug',
    );
    expect(validarDadosEmpresa({ tom: 'formal' }, true)).toEqual({
      tom: 'formal',
    });
  });

  it('recusa slug e cor fora do formato', () => {
    const campos = camposComErro(() =>
      validarDadosEmpresa(
        { ...valido, slug: 'Padaria Centro', corPrimaria: 'azul' },
        false,
      ),
    );
    expect(campos).toHaveProperty('slug');
    expect(campos).toHaveProperty('corPrimaria');
  });

  it('ignora campos desconhecidos', () => {
    expect(validarDadosEmpresa({ id: 'x', tom: 'formal' }, true)).toEqual({
      tom: 'formal',
    });
  });
});

describe('sugestões do widget', () => {
  it('apara, descarta vazias e repetidas', () => {
    expect(
      validarDadosEmpresa(
        { sugestoes: [' Horários ', '', 'Horários', 'Cardápio'] },
        true,
      ),
    ).toEqual({ sugestoes: ['Horários', 'Cardápio'] });
  });

  it('recusa formato errado, excesso e texto longo', () => {
    expect(
      camposComErro(() => validarDadosEmpresa({ sugestoes: 'Horários' }, true)),
    ).toHaveProperty('sugestoes');
    expect(
      camposComErro(() =>
        validarDadosEmpresa({ sugestoes: ['a', 'b', 'c', 'd', 'e'] }, true),
      ),
    ).toHaveProperty('sugestoes');
    expect(
      camposComErro(() =>
        validarDadosEmpresa({ sugestoes: ['x'.repeat(41)] }, true),
      ),
    ).toHaveProperty('sugestoes');
  });
});
