import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import {
  Marketplace,
  MarketplaceAccount,
} from './entities/marketplace-account.entity';
import { CreateCompanyDto } from './dto/create-company.dto';

export interface UpsertMarketplaceAccountDto {
  tenantId: string;
  companyId: string;
  marketplace: Marketplace;
  sellerId: string;
  sellerName: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  tokenExpiresAt: Date;
}

export interface UpdateTokensDto {
  accessTokenEnc: string;
  refreshTokenEnc: string;
  tokenExpiresAt: Date;
}

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
  ) {}

  async createCompany(
    tenantId: string,
    dto: CreateCompanyDto,
  ): Promise<Company> {
    const company = this.companyRepo.create({ ...dto, tenantId });
    return this.companyRepo.save(company);
  }

  async findAllCompanies(tenantId: string): Promise<Company[]> {
    return this.companyRepo.find({
      where: { tenantId, isActive: true },
      relations: ['marketplaceAccounts'],
    });
  }

  async findOneCompany(tenantId: string, id: string): Promise<Company> {
    const company = await this.companyRepo.findOne({
      where: { id, tenantId },
      relations: ['marketplaceAccounts'],
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async findAllAccounts(tenantId: string): Promise<MarketplaceAccount[]> {
    return this.accountRepo.find({
      where: { tenantId, isActive: true },
      relations: ['company'],
    });
  }

  /**
   * Desconecta (desativa) uma conta de marketplace. Não apaga o histórico —
   * só tira a conta de circulação para o sistema parar de usá-la.
   */
  async disconnectAccount(
    tenantId: string,
    accountId: string,
  ): Promise<{ success: boolean }> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId, tenantId },
    });
    if (!account) throw new NotFoundException('Conta não encontrada');

    await this.accountRepo.update(account.id, { isActive: false });
    return { success: true };
  }

  /**
   * Cria ou atualiza a conta de marketplace.
   * Identificador único: tenantId + companyId + marketplace + sellerId.
   */
  async upsertMarketplaceAccount(
    dto: UpsertMarketplaceAccountDto,
  ): Promise<MarketplaceAccount> {
    let account = await this.accountRepo.findOne({
      where: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        marketplace: dto.marketplace,
        sellerId: dto.sellerId,
      },
    });

    if (!account) {
      account = this.accountRepo.create({
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        marketplace: dto.marketplace,
        sellerId: dto.sellerId,
      });
    }

    account.sellerName = dto.sellerName;
    account.accessTokenEnc = dto.accessTokenEnc;
    account.refreshTokenEnc = dto.refreshTokenEnc;
    account.tokenExpiresAt = dto.tokenExpiresAt;
    account.isActive = true;

    const saved = await this.accountRepo.save(account);

    // Mantém só a conta recém-conectada ativa para este marketplace/tenant.
    // Sem isso, conexões antigas (de outra empresa ou outro seller) continuam
    // ativas e o sistema pode escolher uma delas, com refresh token já morto.
    await this.accountRepo
      .createQueryBuilder()
      .update()
      .set({ isActive: false })
      .where('tenant_id = :tenantId', { tenantId: dto.tenantId })
      .andWhere('marketplace = :marketplace', { marketplace: dto.marketplace })
      .andWhere('id != :id', { id: saved.id })
      .execute();

    return saved;
  }

  /**
   * Atualiza apenas os tokens de uma conta existente (usado no refresh automático).
   */
  async updateTokens(accountId: string, dto: UpdateTokensDto): Promise<void> {
    await this.accountRepo.update(accountId, {
      accessTokenEnc: dto.accessTokenEnc,
      refreshTokenEnc: dto.refreshTokenEnc,
      tokenExpiresAt: dto.tokenExpiresAt,
    });
  }
}
