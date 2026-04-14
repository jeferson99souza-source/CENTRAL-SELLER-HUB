import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('complaints')
export class Complaint {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column()
  tenantId: string;

  @ApiProperty()
  @Column()
  externalId: string;

  @ApiProperty({ enum: ['mercadolivre', 'shopee', 'amazon'] })
  @Column()
  marketplace: string;

  @ApiProperty()
  @Column('text')
  reason: string;

  @ApiProperty({ enum: ['open', 'pending', 'closed'] })
  @Column({ default: 'open' })
  status: 'open' | 'pending' | 'closed';

  @ApiProperty({ enum: ['urgent', 'high', 'normal'] })
  @Column({ default: 'urgent' })
  priority: 'urgent' | 'high' | 'normal';

  @ApiProperty()
  @Column({ type: 'timestamp' })
  slaDeadline: Date;

  @ApiProperty()
  @Column({ nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
