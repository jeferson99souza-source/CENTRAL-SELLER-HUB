import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('orders')
export class Order {
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

  @ApiProperty()
  @Column({ nullable: true })
  packId: string;

  @ApiProperty()
  @Column({ nullable: true })
  buyerId: string;

  @ApiProperty()
  @Column({ nullable: true })
  buyerName: string;

  @ApiProperty()
  @Column({ nullable: true })
  buyerEmail: string;

  @ApiProperty()
  @Column({ nullable: true })
  itemId: string;

  @ApiProperty()
  @Column({ nullable: true })
  itemTitle: string;

  @ApiProperty()
  @Column({ nullable: true })
  itemQuantity: number;

  @ApiProperty()
  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @ApiProperty()
  @Column({ nullable: true })
  currency: string;

  @ApiProperty()
  @Column({ default: 'confirmed' })
  status: string;

  @ApiProperty()
  @Column({ nullable: true })
  shippingStatus: string;

  @ApiProperty()
  @Column({ nullable: true })
  trackingNumber: string;

  @ApiProperty()
  @Column({ nullable: true, type: 'timestamp' })
  orderDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
