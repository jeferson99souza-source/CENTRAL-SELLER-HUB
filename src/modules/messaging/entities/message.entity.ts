import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type MessageSender = 'cliente' | 'vendedor' | 'bot';
export type MessageStatus = 'pending' | 'read' | 'replied';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'marketplace_account_id' })
  marketplaceAccountId: string;

  @Column({ name: 'order_id', nullable: true })
  orderId: string;

  @Column({ name: 'pack_id', nullable: true })
  packId: string;

  @Column({ name: 'external_id', nullable: true })
  externalId: string;

  @Column({ type: 'varchar' })
  sender: MessageSender;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: MessageStatus;

  @Column({ name: 'sla_deadline', nullable: true })
  slaDeadline: Date;

  @Column({ name: 'replied_at', nullable: true })
  repliedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
