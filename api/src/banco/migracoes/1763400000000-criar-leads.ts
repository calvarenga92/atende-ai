import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarLeads1763400000000 implements MigrationInterface {
  name = 'CriarLeads1763400000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      create table leads (
        id uuid primary key default gen_random_uuid(),
        empresa_id uuid not null references empresas(id) on delete cascade,
        conversa_id uuid not null unique references conversas(id) on delete cascade,
        nome varchar not null,
        contato varchar not null,
        tipo_contato varchar(16) not null check (tipo_contato in ('email', 'telefone')),
        interesse text not null default '',
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      )`);
    await q.query(`create index leads_empresa_id_idx on leads (empresa_id)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`drop table leads`);
  }
}
