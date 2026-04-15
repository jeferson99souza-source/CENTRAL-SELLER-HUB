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

  @Column({ name: 'buyer_id', nullable: true })
  buyerId: string;

  @Column({ name: 'buyer_name', nullable: true })
  buyerName: string;

  @Column({ name: 'item_title', nullable: true })
  itemTitle: string;

  @Column({ name: 'order_status', nullable: true })
  orderStatus: string;

  @Column({ name: 'shipping_status', nullable: true })
  shippingStatus: string;

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
