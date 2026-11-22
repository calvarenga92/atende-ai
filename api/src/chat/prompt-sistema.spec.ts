import { montarPromptSistema } from './prompt-sistema.js';

const empresa = {
  nome: 'Padaria Centro',
  nomeBot: 'Lia',
  tom: 'simpático',
  instrucoes: '',
  conhecimento: 'Abrimos às 6h.',
};

describe('montarPromptSistema', () => {
  it('inclui persona, tom e a base de conhecimento', () => {
    const prompt = montarPromptSistema(empresa);
    expect(prompt).toContain('Você é Lia');
    expect(prompt).toContain('Padaria Centro');
    expect(prompt).toContain('Tom de voz: simpático.');
    expect(prompt).toContain(
      '<base_de_conhecimento>\nAbrimos às 6h.\n</base_de_conhecimento>',
    );
  });

  it('só inclui orientações quando a empresa escreveu alguma', () => {
    expect(montarPromptSistema(empresa)).not.toContain(
      'Orientações da empresa',
    );
    expect(
      montarPromptSistema({ ...empresa, instrucoes: 'Ofereça bolo.' }),
    ).toContain('Orientações da empresa:\nOfereça bolo.');
  });

  it('pede texto simples, sem Markdown (o widget não mostra asteriscos)', () => {
    expect(montarPromptSistema(empresa)).toContain('sem Markdown');
  });

  it('é determinístico, para o cache da API funcionar', () => {
    expect(montarPromptSistema(empresa)).toBe(
      montarPromptSistema({ ...empresa }),
    );
  });
});
