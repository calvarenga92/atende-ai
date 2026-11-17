import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarEsquema1763380000000 implements MigrationInterface {
  name = 'CriarEsquema1763380000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      create table empresas (
        id uuid primary key default gen_random_uuid(),
        slug varchar not null unique,
        nome varchar not null,
        nome_bot varchar not null,
        tom text not null,
        instrucoes text not null default '',
        conhecimento text not null default '',
        mensagem_boas_vindas text not null,
        cor_primaria varchar not null default '#4f46e5',
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      )`);
    await q.query(`
      create table conversas (
        id uuid primary key default gen_random_uuid(),
        empresa_id uuid not null references empresas(id) on delete cascade,
        criado_em timestamptz not null default now()
      )`);
    await q.query(
      `create index conversas_empresa_id_idx on conversas (empresa_id)`,
    );
    await q.query(`
      create table mensagens (
        id bigserial primary key,
        conversa_id uuid not null references conversas(id) on delete cascade,
        papel varchar(16) not null check (papel in ('user', 'assistant')),
        conteudo jsonb not null,
        criado_em timestamptz not null default now()
      )`);
    await q.query(
      `create index mensagens_conversa_id_id_idx on mensagens (conversa_id, id)`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`drop table mensagens`);
    await q.query(`drop table conversas`);
    await q.query(`drop table empresas`);
  }
}
