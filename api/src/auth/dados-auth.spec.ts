import { ErroAplicacao } from '../comum/erro-aplicacao.js';
import { validarCadastro, validarEntrada } from './dados-auth.js';

function campos(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErroAplicacao) return e.campos ?? {};
    throw e;
  }
  throw new Error('Deveria ter recusado.');
}

const cadastroValido = {
  nome: 'Ana Souza',
  email: '  Ana@Exemplo.COM ',
  senha: 'segredo-bom',
  empresa: { nome: 'Doceria da Ana', slug: 'doceria-da-ana' },
};

describe('validarCadastro', () => {
  it('aceita o mínimo e completa o bot com um padrão neutro', () => {
    const d = validarCadastro(cadastroValido);
    expect(d.email).toBe('ana@exemplo.com');
    expect(d.senha).toBe('segredo-bom');
    expect(d.empresa).toMatchObject({
      nome: 'Doceria da Ana',
      slug: 'doceria-da-ana',
      nomeBot: 'Assistente',
    });
    expect(d.empresa.mensagemBoasVindas).toContain('Doceria da Ana');
  });

  it('deixa a pessoa já escolher o nome do bot', () => {
    const d = validarCadastro({
      ...cadastroValido,
      empresa: { ...cadastroValido.empresa, nomeBot: 'Bia' },
    });
    expect(d.empresa.nomeBot).toBe('Bia');
  });

  it('aponta cada campo com problema, inclusive os da empresa', () => {
    expect(
      campos(() =>
        validarCadastro({
          nome: '',
          email: 'sem-arroba',
          senha: 'curta',
          empresa: { nome: '', slug: 'Com Espaço' },
        }),
      ),
    ).toEqual({
      nome: 'Obrigatório.',
      email: 'E-mail inválido.',
      senha: 'Use pelo menos 8 caracteres.',
      'empresa.nome': 'Obrigatório.',
      'empresa.slug':
        'Use letras minúsculas, números e hífen (ex.: padaria-centro).',
    });
  });

  it('pede a empresa quando ela não vem', () => {
    const { empresa, ...semEmpresa } = cadastroValido;
    expect(empresa).toBeDefined();
    expect(campos(() => validarCadastro(semEmpresa))).toMatchObject({
      'empresa.nome': 'Obrigatório.',
      'empresa.slug': 'Obrigatório.',
    });
  });

  it('recusa senha gigante', () => {
    expect(
      campos(() =>
        validarCadastro({ ...cadastroValido, senha: 'a'.repeat(129) }),
      ),
    ).toEqual({ senha: 'Máximo de 128 caracteres.' });
  });
});

describe('validarEntrada', () => {
  it('normaliza o e-mail e não cobra tamanho mínimo da senha', () => {
    expect(validarEntrada({ email: 'X@Y.com', senha: '123' })).toEqual({
      email: 'x@y.com',
      senha: '123',
    });
  });

  it('não apara a senha', () => {
    expect(validarEntrada({ email: 'x@y.com', senha: ' a b ' }).senha).toBe(
      ' a b ',
    );
  });

  it('recusa corpo que não é objeto', () => {
    expect(campos(() => validarEntrada('oi'))).toEqual({
      corpo: 'Envie um objeto JSON.',
    });
  });
});
