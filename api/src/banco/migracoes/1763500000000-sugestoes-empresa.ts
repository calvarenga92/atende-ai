import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Atalhos que o widget mostra embaixo das boas-vindas ("Horários", "Cardápio"...). */
export class SugestoesEmpresa1763500000000 implements MigrationInterface {
  name = 'SugestoesEmpresa1763500000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `alter table empresas add column sugestoes text[] not null default '{}'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`alter table empresas drop column sugestoes`);
  }
}
