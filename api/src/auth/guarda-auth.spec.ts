import type { ExecutionContext } from '@nestjs/common';
import { ErroAplicacao } from '../comum/erro-aplicacao.js';
import { rotaPublica } from '../configurar-app.js';
import type { AuthService, UsuarioLogado } from './auth.service.js';
import { extrairToken, GuardaAuth } from './guarda-auth.js';

const TOKEN = 'a'.repeat(43);

describe('extrairToken', () => {
  it('lê o Bearer (sem ligar para maiúsculas)', () => {
    expect(extrairToken(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(extrairToken(`bearer ${TOKEN}`)).toBe(TOKEN);
  });

  it.each([
    undefined,
    '',
    TOKEN,
    `Basic ${TOKEN}`,
    'Bearer curto',
    `Bearer ${TOKEN} extra`,
    `Bearer ${'a'.repeat(42)}=`,
  ])('recusa %s', (cabecalho) => {
    expect(extrairToken(cabecalho)).toBeNull();
  });
});

describe('GuardaAuth', () => {
  const usuario: UsuarioLogado = {
    id: 'u1',
    nome: 'Ana',
    email: 'ana@x.com',
    empresaId: 'e1',
    sessaoId: 's1',
  };

  function contexto(authorization?: string) {
    const req: Record<string, unknown> = { headers: { authorization } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { req, ctx };
  }

  it('pendura o usuário na requisição quando o token vale', async () => {
    const guarda = new GuardaAuth({
      autenticar: async (t: string) => {
        expect(t).toBe(TOKEN);
        return usuario;
      },
    } as unknown as AuthService);
    const { req, ctx } = contexto(`Bearer ${TOKEN}`);
    expect(await guarda.canActivate(ctx)).toBe(true);
    expect(req.usuario).toBe(usuario);
  });

  it('responde 401 sem cabeçalho, sem ir ao banco', async () => {
    const guarda = new GuardaAuth({
      autenticar: () => {
        throw new Error('não deveria consultar');
      },
    } as unknown as AuthService);
    await expect(guarda.canActivate(contexto().ctx)).rejects.toMatchObject({
      status: 401,
      codigo: 'NAO_AUTENTICADO',
    });
  });

  it('repassa o 401 de sessão vencida', async () => {
    const guarda = new GuardaAuth({
      autenticar: async () => {
        throw new ErroAplicacao(401, 'NAO_AUTENTICADO', 'expirou');
      },
    } as unknown as AuthService);
    await expect(
      guarda.canActivate(contexto(`Bearer ${TOKEN}`).ctx),
    ).rejects.toBeInstanceOf(ErroAplicacao);
  });
});

describe('rotaPublica (CORS aberto só para o widget)', () => {
  it.each([
    '/api/chat/padaria-demo',
    '/api/chat/x/config',
    '/api/saude',
    '/api/saude?x=1',
  ])('%s é pública', (url) => expect(rotaPublica(url)).toBe(true));
  it.each([
    '/api/auth/entrar',
    '/api/painel/leads',
    '/api/chatfalso',
    '/api/saudeX',
  ])('%s não é', (url) => expect(rotaPublica(url)).toBe(false));
});
