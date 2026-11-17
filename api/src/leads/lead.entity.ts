import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Visitante que deixou nome e contato pelo chat. Um por conversa. */
@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @Column({ name: 'conversa_id', type: 'uuid', unique: true })
  conversaId: string;

  @Column()
  nome: string;

  @Column()
  contato: string;

  @Column({ name: 'tipo_contato', type: 'varchar', length: 16 })
  tipoContato: 'email' | 'telefone';

  /** Resumo do que a pessoa quer, escrito pela IA. */
  @Column({ type: 'text', default: '' })
  interesse: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
