// Desenvolvimento sem Docker: sobe um Postgres local (PGlite, dados em .banco-local/)
// e a API em modo watch apontando para ele, com a empresa demo cadastrada.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const PORTA_BANCO = Number(process.env.PORTA_BANCO ?? 5434);

const db = await PGlite.create('./.banco-local');
const servidor = new PGLiteSocketServer({ db, port: PORTA_BANCO, host: '127.0.0.1' });
await servidor.start();

const urlBanco = `postgres://postgres:postgres@127.0.0.1:${PORTA_BANCO}/postgres?sslmode=disable`;
console.log(`Banco local em ${urlBanco}`);

if (!existsSync('.env')) {
  console.warn('Sem .env: copie o .env.example e preencha ANTHROPIC_API_KEY para o bot responder.');
}

const nest = createRequire(import.meta.url).resolve('@nestjs/cli/bin/nest.js');
const api = spawn(
  process.execPath,
  ['--env-file-if-exists=.env', nest, 'start', '--watch'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? urlBanco,
      SEMEAR_DEMO: '1',
    },
  },
);

let encerrando = false;
async function encerrar(codigo = 0) {
  if (encerrando) return;
  encerrando = true;
  api.kill();
  await servidor.stop();
  await db.close();
  process.exit(codigo);
}

api.on('exit', (codigo) => void encerrar(codigo ?? 0));
process.on('SIGINT', () => void encerrar());
process.on('SIGTERM', () => void encerrar());
