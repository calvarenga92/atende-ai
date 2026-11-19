import { contraste, montarPaleta } from './cores.js';

describe('montarPaleta', () => {
  it('usa texto branco sobre cor escura e escuro sobre cor clara', () => {
    expect(montarPaleta('#b45309').sobreBase).toBe('#ffffff');
    expect(montarPaleta('#fde047').sobreBase).toBe('#1c1917');
  });

  it('o texto escolhido passa do AA (4,5:1) nas cores do painel', () => {
    for (const cor of ['#b45309', '#e11d48', '#7c3aed', '#0891b2', '#059669', '#1a1033']) {
      const p = montarPaleta(cor);
      expect(contraste(p.base, p.sobreBase)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('cai na cor padrão se a empresa mandar algo fora do formato', () => {
    expect(montarPaleta('azul').base).toBe('#4f46e5');
  });

  it('deriva tons mais claros e mais escuros da mesma cor', () => {
    const p = montarPaleta('#b45309');
    expect(contraste(p.fundo, '#ffffff')).toBeLessThan(1.1);
    expect(contraste(p.escura, '#ffffff')).toBeGreaterThan(contraste(p.base, '#ffffff'));
  });
});
