import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('questions')
export class Question {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column()
  tenantId: string;

  @ApiProperty()
  @Column()
  externalId: string;

  @ApiProperty()
  @Column({ default: 'mercadolivre' })
  marketplace: string;

  // Loja de origem. Com várias lojas no mesmo marketplace, é o que garante
  // que a resposta saia pela loja certa e que o sync de uma loja não feche as
  // perguntas de outra. Vazio nas perguntas salvas antes desta coluna existir.
  @ApiProperty()
  @Column({ nullable: true })
  marketplaceAccountId: string;

  @ApiProperty()
  @Column({ nullable: true })
  itemId: string;

  @ApiProperty()
  @Column({ nullable: true })
  itemTitle: string;

  @ApiProperty()
  @Column({ nullable: true })
  buyerId: string;

  @ApiProperty()
  @Column({ nullable: true })
  buyerName: string;

  @ApiProperty()
  @Column('text')
  text: string;

  @ApiProperty()
  @Column({ nullable: true, type: 'text' })
  answer: string;

  @ApiProperty({ enum: ['unanswered', 'answered', 'closed_unanswered'] })
  @Column({ default: 'unanswered' })
  status: string;

  @ApiProperty()
  @Column({ type: 'timestamp' })
  slaDeadline: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
