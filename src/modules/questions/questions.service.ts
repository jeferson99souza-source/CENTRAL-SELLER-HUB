import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from './entities/question.entity';
import { MarketplaceAccount } from '../accounts/entities/marketplace-account.entity';
import { MercadoLivreService } from '../integration/services/mercadolivre.service';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    private readonly mlService: MercadoLivreService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  findAll(tenantId: string, status?: string): Promise<Question[]> {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.questionRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  findPending(tenantId: string): Promise<Question[]> {
    return this.questionRepo.find({
      where: { tenantId, status: 'unanswered' },
      order: { createdAt: 'ASC' },
    });
  }

  async answerQuestion(tenantId: string, questionId: string, text: string): Promise<Question> {
    if (!text?.trim()) {
      throw new BadRequestException('A resposta não pode ser vazia.');
    }

    const question = await this.questionRepo.findOne({ where: { id: questionId, tenantId } });
    if (!question) throw new NotFoundException('Pergunta não encontrada.');

    const account = await this.accountRepo.findOne({
      where: { tenantId, marketplace: 'mercadolivre', isActive: true },
    });
    if (!account) throw new NotFoundException('Conta Mercado Livre não encontrada.');

    const isExpired = !account.tokenExpiresAt || account.tokenExpiresAt < new Date();
    const accessToken = isExpired
      ? await this.mlService.refreshAccountToken(account)
      : this.encryption.decrypt(account.accessTokenEnc);

    // Envia resposta para a API do ML
    await this.mlService.answerQuestion(accessToken, Number(question.externalId), text.trim());

    // Atualiza no banco
    await this.questionRepo.update(question.id, {
      answer: text.trim(),
      status: 'answered',
    });

    return this.questionRepo.findOne({ where: { id: questionId, tenantId } }) as Promise<Question>;
  }
}
