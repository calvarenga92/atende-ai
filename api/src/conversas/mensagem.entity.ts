import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type Papel = 'user' | 'assistant';

@Entity('mensagens')
@Index(['conversaId', 'id'])
export class Mensagem {
  /** Sequencial: define a ordem das mensagens dentro da conversa. */
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'conversa_id', type: 'uuid' })
  conversaId: string;

  @Column({ type: 'varchar', length: 16 })
  papel: Papel;

  /**
   * Blocos de conteúdo exatamente como a API da Claude devolveu (texto, thinking...).
   * Voltam sem alteração na próxima chamada: editar ou descartar bloco de thinking
   * invalida o raciocínio preservado do modelo.
   */
  @Column({ type: 'jsonb' })
  conteudo: unknown[];

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
