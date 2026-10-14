import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export type AnswerSource = 'pergunta' | 'mensagem';

/**
 * Base de conhecimento do vendedor.
 *
 * Cada resposta que o vendedor escreve (em Perguntas ou Mensagens) é guardada
 * aqui junto do texto do cliente. Esses pares viram exemplos para a IA sugerir
 * respostas no estilo e nas políticas do próprio vendedor — em vez de um texto
 * genérico.
 */
@Entity('answer_templates')
export class AnswerTemplate {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Index()
  @Column({ name: 'tenant_id' })
  tenantId: string;

  @ApiProperty({ enum: ['pergunta', 'mensagem'] })
  @Column({ type: 'varchar', default: 'pergunta' })
  source: AnswerSource;

  /** O que o cliente perguntou/escreveu */
  @ApiProperty()
  @Column({ name: 'customer_text', type: 'text' })
  customerText: string;

  /** O que o vendedor respondeu */
  @ApiProperty()
  @Column({ name: 'seller_answer', type: 'text' })
  sellerAnswer: string;

  @ApiProperty()
  @Column({ name: 'item_title', nullable: true })
  itemTitle: string;

  /** Quantas vezes essa resposta já serviu de base para uma sugestão */
  @ApiProperty()
  @Column({ name: 'use_count', default: 0 })
  useCount: number;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
