import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { MarketplaceAccount } from './entities/marketplace-account.entity';
import { CreateCompanyDto } from './dto/create-company.dto';

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
}
