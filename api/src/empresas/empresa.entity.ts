import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Cliente do SaaS. Cada empresa tem seu bot, com persona e base de conhecimento próprias. */
@Entity('empresas')
export class Empresa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Identificador público, usado na URL do chat e no script do widget. */
  @Column({ unique: true })
  slug: string;

  @Column()
  nome: string;

  @Column({ name: 'nome_bot' })
  nomeBot: string;

  /** Tom de voz em texto livre: "simpático e informal", "formal e objetivo"... */
  @Column({ type: 'text' })
  tom: string;

  /** Regras extras da empresa para o bot (o que oferecer, o que evitar...). */
  @Column({ type: 'text', default: '' })
  instrucoes: string;

  /** Base de conhecimento: FAQ, horários, preços, políticas. Texto corrido. */
  @Column({ type: 'text', default: '' })
  conhecimento: string;

  @Column({ name: 'mensagem_boas_vindas', type: 'text' })
  mensagemBoasVindas: string;

  @Column({ name: 'cor_primaria', default: '#4f46e5' })
  corPrimaria: string;

  /** Atalhos do widget, mostrados embaixo das boas-vindas. Clicar envia o texto. */
  @Column('text', { array: true, default: () => "'{}'" })
  sugestoes: string[];

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
