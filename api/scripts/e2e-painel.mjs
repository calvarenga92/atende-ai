// Ponta a ponta do login e do painel: sobe um Postgres em memória (PGlite) e a API
// compilada (dist/), e confere o fluxo pela HTTP de verdade. Não toca no .banco-local/.
// Uso: npm run build && npm run e2e
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const PORTA_BANCO = 5499;
const PORTA_API = 3199;
const BASE = `http://127.0.0.1:${PORTA_API}/api`;
const PAINEL = 'http://localhost:5173';

const db = await PGlite.create();
const servidor = new PGLiteSocketServer({ db, port: PORTA_BANCO, host: '127.0.0.1' });
await servidor.start();

const api = spawn(process.execPath, ['dist/main.js'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PORTA_BANCO}/postgres?sslmode=disable`,
    PORT: String(PORTA_API),
    SEMEAR_DEMO: '1',
    IA_PROVEDOR: 'simulado',
    CORS_ORIGENS: PAINEL,
  },
});
let saida = '';
api.stdout.on('data', (d) => (saida += d));
api.stderr.on('data', (d) => (saida += d));

async function encerrar(codigo) {
  api.kill();
  await servidor.stop();
  await db.close();
  process.exit(codigo);
}

async function pedir(metodo, rota, { corpo, token, origem } = {}) {
  const r = await fetch(BASE + rota, {
    method: metodo,
    headers: {
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(origem ? { Origin: origem } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  return { status: r.status, cabecalhos: r.headers, corpo: texto ? JSON.parse(texto) : null };
}

let passou = 0;
async function caso(nome, fn) {
  await fn();
  passou++;
  console.log(`  ok  ${nome}`);
}

try {
  // Espera a API subir (migrações + semente da demo).
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${BASE}/saude`)).ok) break;
    } catch {}
    if (i > 120) throw new Error('A API não subiu em 60 s.');
    await new Promise((ok) => setTimeout(ok, 500));
  }
  console.log('API no ar. Conferindo:');

  let tokenDemo;
  let tokenAna;

  await caso('rotas antigas e abertas de /api/empresas não existem mais', async () => {
    assert.equal((await pedir('GET', '/empresas')).status, 404);
    assert.equal((await pedir('GET', '/empresas/padaria-demo/leads')).status, 404);
  });

  await caso('painel sem login responde 401', async () => {
    const r = await pedir('GET', '/painel/empresa');
    assert.equal(r.status, 401);
    assert.equal(r.corpo.codigo, 'NAO_AUTENTICADO');
  });

  await caso('conta demo entra e recebe a padaria', async () => {
    const r = await pedir('POST', '/auth/entrar', {
      corpo: { email: 'DEMO@padaria-demo.local', senha: 'demo12345' },
    });
    assert.equal(r.status, 200);
    assert.match(r.corpo.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(r.corpo.empresa.slug, 'padaria-demo');
    assert.equal(r.corpo.usuario.senhaHash, undefined);
    tokenDemo = r.corpo.token;
  });

  await caso('senha errada: 401 com mensagem genérica', async () => {
    const r = await pedir('POST', '/auth/entrar', {
      corpo: { email: 'demo@padaria-demo.local', senha: 'errada123' },
    });
    assert.equal(r.status, 401);
    assert.equal(r.corpo.mensagem, 'E-mail ou senha incorretos.');
    const s = await pedir('POST', '/auth/entrar', {
      corpo: { email: 'ninguem@x.com', senha: 'errada123' },
    });
    assert.equal(s.corpo.mensagem, r.corpo.mensagem);
  });

  await caso('cadastro cria empresa + conta e já entra', async () => {
    const r = await pedir('POST', '/auth/cadastro', {
      corpo: {
        nome: 'Ana Souza',
        email: 'ana@doceria.com',
        senha: 'brigadeiro-123',
        empresa: { nome: 'Doceria da Ana', slug: 'doceria-da-ana' },
      },
    });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.empresa.slug, 'doceria-da-ana');
    assert.equal(r.corpo.empresa.nomeBot, 'Assistente');
    tokenAna = r.corpo.token;
    // O widget já funciona para a empresa nova.
    const cfg = await pedir('GET', '/chat/doceria-da-ana/config');
    assert.equal(cfg.status, 200);
  });

  await caso('cadastro repetido: e-mail e slug em uso dão 409, nada criado pela metade', async () => {
    const email = await pedir('POST', '/auth/cadastro', {
      corpo: {
        nome: 'Outra',
        email: 'ana@doceria.com',
        senha: 'qualquer-123',
        empresa: { nome: 'Outra', slug: 'outra-loja' },
      },
    });
    assert.equal(email.status, 409);
    assert.equal((await pedir('GET', '/chat/outra-loja/config')).status, 404);
    const slug = await pedir('POST', '/auth/cadastro', {
      corpo: {
        nome: 'Bruno',
        email: 'bruno@x.com',
        senha: 'qualquer-123',
        empresa: { nome: 'Padaria 2', slug: 'padaria-demo' },
      },
    });
    assert.equal(slug.status, 409);
    const bruno = await pedir('POST', '/auth/entrar', {
      corpo: { email: 'bruno@x.com', senha: 'qualquer-123' },
    });
    assert.equal(bruno.status, 401, 'a conta do Bruno não pode ter sido criada');
  });

  await caso('cadastro inválido: 422 com os campos', async () => {
    const r = await pedir('POST', '/auth/cadastro', { corpo: { email: 'x' } });
    assert.equal(r.status, 422);
    assert.ok(r.corpo.campos.senha && r.corpo.campos['empresa.slug']);
  });

  await caso('cada login só enxerga a própria empresa', async () => {
    const demo = await pedir('GET', '/painel/empresa', { token: tokenDemo });
    const ana = await pedir('GET', '/painel/empresa', { token: tokenAna });
    assert.equal(demo.corpo.slug, 'padaria-demo');
    assert.equal(ana.corpo.slug, 'doceria-da-ana');
  });

  await caso('lead do chat aparece só no painel da empresa dele', async () => {
    const r = await fetch(`${BASE}/chat/padaria-demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem: 'Quero um bolo. Sou a Marta, 11 98888-1234' }),
    });
    assert.match(await r.text(), /"tipo":"lead"/);
    const demo = await pedir('GET', '/painel/leads', { token: tokenDemo });
    const ana = await pedir('GET', '/painel/leads', { token: tokenAna });
    assert.equal(demo.corpo.length, 1);
    assert.equal(demo.corpo[0].contato, '11988881234');
    assert.equal(ana.corpo.length, 0);
  });

  await caso('PATCH edita a própria empresa e valida', async () => {
    const r = await pedir('PATCH', '/painel/empresa', {
      token: tokenAna,
      corpo: { nomeBot: 'Bia', sugestoes: ['Encomendas', 'Preços'], corPrimaria: '#db2777' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.nomeBot, 'Bia');
    const cfg = await pedir('GET', '/chat/doceria-da-ana/config');
    assert.equal(cfg.corpo.nomeBot, 'Bia');
    const ruim = await pedir('PATCH', '/painel/empresa', {
      token: tokenAna,
      corpo: { corPrimaria: 'rosa' },
    });
    assert.equal(ruim.status, 422);
    const slug = await pedir('PATCH', '/painel/empresa', {
      token: tokenAna,
      corpo: { slug: 'padaria-demo' },
    });
    assert.equal(slug.status, 409);
  });

  await caso('/auth/eu devolve a conta e a empresa', async () => {
    const r = await pedir('GET', '/auth/eu', { token: tokenAna });
    assert.equal(r.corpo.usuario.email, 'ana@doceria.com');
    assert.equal(r.corpo.empresa.nomeBot, 'Bia');
  });

  await caso('CORS: chat aberto a qualquer site; login só para o painel', async () => {
    const chat = await pedir('GET', '/chat/padaria-demo/config', { origem: 'https://site-qualquer.com' });
    assert.equal(chat.cabecalhos.get('access-control-allow-origin'), 'https://site-qualquer.com');
    const login = await pedir('GET', '/auth/eu', { token: tokenAna, origem: 'https://site-qualquer.com' });
    assert.equal(login.cabecalhos.get('access-control-allow-origin'), null);
    const painel = await pedir('GET', '/auth/eu', { token: tokenAna, origem: PAINEL });
    assert.equal(painel.cabecalhos.get('access-control-allow-origin'), PAINEL);
  });

  await caso('sair invalida o token', async () => {
    assert.equal((await pedir('POST', '/auth/sair', { token: tokenAna })).status, 204);
    assert.equal((await pedir('GET', '/painel/empresa', { token: tokenAna })).status, 401);
    assert.equal((await pedir('GET', '/painel/empresa', { token: tokenDemo })).status, 200);
  });

  await caso('5 senhas erradas bloqueiam (429), mesmo com a senha certa depois', async () => {
    for (let i = 0; i < 5; i++) {
      await pedir('POST', '/auth/entrar', { corpo: { email: 'ana@doceria.com', senha: `errada-${i}` } });
    }
    const r = await pedir('POST', '/auth/entrar', {
      corpo: { email: 'ana@doceria.com', senha: 'brigadeiro-123' },
    });
    assert.equal(r.status, 429);
    assert.equal(r.corpo.codigo, 'MUITAS_TENTATIVAS');
  });

  console.log(`\n${passou} casos ok.`);
  await encerrar(0);
} catch (e) {
  console.error(`\nFALHOU: ${e.message}\n`);
  if (e.actual !== undefined) console.error({ esperado: e.expected, veio: e.actual });
  console.error('--- saída da API ---\n' + saida.slice(-3000));
  await encerrar(1);
}
