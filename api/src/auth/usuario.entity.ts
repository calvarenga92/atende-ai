import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Pessoa que entra no painel. Pertence a uma empresa e só enxerga os dados dela. */
@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @Column()
  nome: string;

  /** Sempre em minúsculas. */
  @Column({ unique: true })
  email: string;

  /** Nunca sai da API: o select padrão não traz. */
  @Column({ name: 'senha_hash', select: false })
  senhaHash: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
