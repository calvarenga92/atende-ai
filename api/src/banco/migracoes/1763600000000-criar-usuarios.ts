import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Contas do painel (uma empresa pode ter várias pessoas) e sessões de login. */
export class CriarUsuarios1763600000000 implements MigrationInterface {
  name = 'CriarUsuarios1763600000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      create table usuarios (
        id uuid primary key default gen_random_uuid(),
        empresa_id uuid not null references empresas(id) on delete cascade,
        nome varchar not null,
        email varchar not null unique,
        senha_hash varchar not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      )`);
    await q.query(
      `create index usuarios_empresa_id_idx on usuarios (empresa_id)`,
    );
    // Guarda só o hash do token: quem lê o banco não consegue entrar como ninguém.
    await q.query(`
      create table sessoes (
        id uuid primary key default gen_random_uuid(),
        usuario_id uuid not null references usuarios(id) on delete cascade,
        token_hash char(64) not null unique,
        expira_em timestamptz not null,
        criado_em timestamptz not null default now()
      )`);
    await q.query(
      `create index sessoes_usuario_id_idx on sessoes (usuario_id)`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`drop table sessoes`);
    await q.query(`drop table usuarios`);
  }
}
