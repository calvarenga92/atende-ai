import { LimiteTentativas } from './limite-tentativas.js';

describe('LimiteTentativas', () => {
  function montar() {
    let agora = 0;
    const limite = new LimiteTentativas(3, 10 * 60_000, () => agora);
    return { limite, passar: (min: number) => (agora += min * 60_000) };
  }

  it('bloqueia depois de 3 falhas e diz quantos minutos faltam', () => {
    const { limite, passar } = montar();
    limite.falhou('ip|a@b.com');
    limite.falhou('ip|a@b.com');
    expect(limite.bloqueado('ip|a@b.com')).toBe(0);
    limite.falhou('ip|a@b.com');
    expect(limite.bloqueado('ip|a@b.com')).toBe(10);
    passar(4);
    expect(limite.bloqueado('ip|a@b.com')).toBe(6);
  });

  it('libera quando a janela passa', () => {
    const { limite, passar } = montar();
    for (let i = 0; i < 3; i++) limite.falhou('k');
    passar(10);
    expect(limite.bloqueado('k')).toBe(0);
    limite.falhou('k');
    expect(limite.bloqueado('k')).toBe(0);
  });

  it('acertar zera as falhas', () => {
    const { limite } = montar();
    limite.falhou('k');
    limite.falhou('k');
    limite.acertou('k');
    limite.falhou('k');
    expect(limite.bloqueado('k')).toBe(0);
  });

  it('uma chave não afeta a outra', () => {
    const { limite } = montar();
    for (let i = 0; i < 3; i++) limite.falhou('ip|a@b.com');
    expect(limite.bloqueado('ip|c@d.com')).toBe(0);
  });
});
