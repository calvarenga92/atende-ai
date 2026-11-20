import {
  conferirSenha,
  gerarHashSenha,
  gerarToken,
  hashToken,
} from './senha.js';

describe('senha', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const hash = await gerarHashSenha('pao-de-queijo-42');
    expect(hash).not.toContain('pao-de-queijo-42');
    expect(await conferirSenha('pao-de-queijo-42', hash)).toBe(true);
    expect(await conferirSenha('pao-de-queijo-43', hash)).toBe(false);
  });

  it('gera hash diferente para a mesma senha (sal aleatório)', async () => {
    const [a, b] = await Promise.all([
      gerarHashSenha('mesma-senha'),
      gerarHashSenha('mesma-senha'),
    ]);
    expect(a).not.toBe(b);
  });

  it('recusa hash em formato desconhecido sem estourar', async () => {
    expect(await conferirSenha('x', '')).toBe(false);
    expect(await conferirSenha('x', 'bcrypt$abc')).toBe(false);
    expect(await conferirSenha('x', 'scrypt$0$8$1$c2Fs$aGFzaA==')).toBe(false);
  });
});

describe('token de sessão', () => {
  it('tem 43 caracteres base64url e não se repete', () => {
    const a = gerarToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(gerarToken()).not.toBe(a);
  });

  it('o hash guardado é SHA-256 em hex e não revela o token', () => {
    const token = gerarToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });
});
