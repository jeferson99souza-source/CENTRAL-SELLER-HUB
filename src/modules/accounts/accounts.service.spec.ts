import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountsService } from './accounts.service';
import { Company } from './entities/company.entity';
import { MarketplaceAccount } from './entities/marketplace-account.entity';

const mockCompanyRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
});

const mockAccountRepo = () => ({
  find: jest.fn(),
});

describe('AccountsService', () => {
  let service: AccountsService;
  let companyRepo: jest.Mocked<Partial<Repository<Company>>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: getRepositoryToken(Company), useFactory: mockCompanyRepo },
        {
          provide: getRepositoryToken(MarketplaceAccount),
          useFactory: mockAccountRepo,
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    companyRepo = module.get(getRepositoryToken(Company));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllCompanies', () => {
    it('deve retornar empresas do tenant', async () => {
      const tenantId = 'tenant-1';
      const companies = [{ id: '1', tenantId, name: 'Empresa A' }];
      (companyRepo.find as jest.Mock).mockResolvedValue(companies);

      const result = await service.findAllCompanies(tenantId);

      expect(companyRepo.find).toHaveBeenCalledWith({
        where: { tenantId, isActive: true },
        relations: ['marketplaceAccounts'],
      });
      expect(result).toEqual(companies);
    });
  });

  describe('createCompany', () => {
    it('deve criar uma empresa para o tenant', async () => {
      const tenantId = 'tenant-1';
      const dto = { name: 'Nova Empresa', cnpj: '12.345.678/0001-99' };
      const created = { id: 'uuid', tenantId, ...dto };

      (companyRepo.create as jest.Mock).mockReturnValue(created);
      (companyRepo.save as jest.Mock).mockResolvedValue(created);

      const result = await service.createCompany(tenantId, dto);

      expect(companyRepo.create).toHaveBeenCalledWith({ ...dto, tenantId });
      expect(result).toEqual(created);
    });
  });
});
