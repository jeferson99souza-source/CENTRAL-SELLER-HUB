import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';

export type Marketplace = 'mercadolivre' | 'shopee' | 'amazon';

@Entity('marketplace_accounts')
export class MarketplaceAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.marketplaceAccounts)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'varchar' })
  marketplace: Marketplace;

  @Column({ name: 'seller_id' })
  sellerId: string;

  @Column({ name: 'seller_name', nullable: true })
  sellerName: string;

  // Tokens criptografados com AES-256-GCM
  @Column({ name: 'access_token_enc', nullable: true })
  accessTokenEnc: string;

  @Column({ name: 'refresh_token_enc', nullable: true })
  refreshTokenEnc: string;

  @Column({ name: 'token_expires_at', nullable: true })
  tokenExpiresAt: Date;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
