import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Question } from './entities/question.entity';
import { MarketplaceAccount } from '../accounts/entities/marketplace-account.entity';
import { MercadoLivreService } from '../integration/services/mercadolivre.service';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';
import { KnowledgeService } from '../automation/knowledge.service';

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    private readonly mlService: MercadoLivreService,
    private readonly encryption: TokenEncryptionService,
    private readonly config: ConfigService,
    private readonly knowledge: KnowledgeService,
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

  async answerQuestion(
    tenantId: string,
    questionId: string,
    text: string,
  ): Promise<Question> {
    if (!text?.trim()) {
      throw new BadRequestException('A resposta não pode ser vazia.');
    }

    const question = await this.questionRepo.findOne({
      where: { id: questionId, tenantId },
    });
    if (!question) throw new NotFoundException('Pergunta não encontrada.');

    const account = await this.accountRepo.findOne({
      where: { tenantId, marketplace: 'mercadolivre', isActive: true },
      order: { updatedAt: 'DESC' }, // sempre a conexão mais recente
    });
    if (!account)
      throw new NotFoundException('Conta Mercado Livre não encontrada.');

    const isExpired =
      !account.tokenExpiresAt || account.tokenExpiresAt < new Date();
    const accessToken = isExpired
      ? await this.mlService.refreshAccountToken(account)
      : this.encryption.decrypt(account.accessTokenEnc);

    // Envia resposta para a API do ML
    await this.mlService.answerQuestion(
      accessToken,
      Number(question.externalId),
      text.trim(),
    );

    // Atualiza no banco
    await this.questionRepo.update(question.id, {
      answer: text.trim(),
      status: 'answered',
    });

    // Aprende com a resposta do vendedor (base de conhecimento da IA)
    await this.knowledge.capture({
      tenantId,
      source: 'pergunta',
      customerText: question.text,
      sellerAnswer: text.trim(),
      itemTitle: question.itemTitle,
    });

    return this.questionRepo.findOne({
      where: { id: questionId, tenantId },
    }) as Promise<Question>;
  }

  // ─── Dispensar pergunta (oculta localmente, não responde no ML) ──────────────
  async dismissQuestion(tenantId: string, questionId: string): Promise<void> {
    const question = await this.questionRepo.findOne({
      where: { id: questionId, tenantId },
    });
    if (!question) throw new NotFoundException('Pergunta não encontrada.');
    await this.questionRepo.update(question.id, {
      status: 'closed_unanswered',
    });
  }

  // ─── Bloquear comprador ──────────────────────────────────────────────────────
  async blockBuyer(
    tenantId: string,
    questionId: string,
  ): Promise<{ blocked: boolean }> {
    const question = await this.questionRepo.findOne({
      where: { id: questionId, tenantId },
    });
    if (!question) throw new NotFoundException('Pergunta não encontrada.');

    const account = await this.accountRepo.findOne({
      where: { tenantId, marketplace: 'mercadolivre', isActive: true },
      order: { updatedAt: 'DESC' }, // sempre a conexão mais recente
    });

    if (account && question.buyerId) {
      try {
        const isExpired =
          !account.tokenExpiresAt || account.tokenExpiresAt < new Date();
        const accessToken = isExpired
          ? await this.mlService.refreshAccountToken(account)
          : this.encryption.decrypt(account.accessTokenEnc);
        await this.mlService.blockBuyer(
          accessToken,
          account.sellerId,
          question.buyerId,
        );
      } catch (err) {
        this.logger.warn(`Falha ao bloquear no ML: ${(err as Error).message}`);
      }
    }

    // Dispensa a pergunta localmente independente do resultado do ML
    await this.questionRepo.update(question.id, {
      status: 'closed_unanswered',
    });
    return { blocked: true };
  }

  // ─── Sugestão de resposta via IA ─────────────────────────────────────────────
  async aiSuggest(
    tenantId: string,
    questionId: string,
  ): Promise<{ suggestion: string }> {
    const question = await this.questionRepo.findOne({
      where: { id: questionId, tenantId },
    });
    if (!question) throw new NotFoundException('Pergunta não encontrada.');

    // IA no estilo do vendedor: usa as respostas anteriores dele como exemplo
    const suggestion = await this.knowledge.suggest({
      tenantId,
      customerText: question.text,
      itemTitle: question.itemTitle,
      source: 'pergunta',
    });
    if (suggestion) return { suggestion };

    // Fallback: template baseado em palavras-chave
    return { suggestion: this.templateAnswer(question.text) };
  }

  private templateAnswer(questionText: string): string {
    const q = questionText.toLowerCase();
    if (q.includes('frete') || q.includes('entrega') || q.includes('prazo'))
      return 'Olá! O prazo de entrega é calculado automaticamente pelo Mercado Livre com base no seu CEP. Você pode verificar o prazo exato na tela de compra. Ficamos à disposição!';
    if (q.includes('garantia') || q.includes('defeito') || q.includes('troca'))
      return 'Olá! Nossos produtos possuem garantia de 90 dias contra defeitos de fabricação. Em caso de problemas, entre em contato conosco que resolveremos rapidamente!';
    if (q.includes('original') || q.includes('nota fiscal') || q.includes('nf'))
      return 'Olá! Sim, todos os nossos produtos são originais e acompanham nota fiscal. Fique à vontade para comprar com segurança!';
    if (
      q.includes('cor') ||
      q.includes('tamanho') ||
      q.includes('medida') ||
      q.includes('modelo')
    )
      return 'Olá! As especificações do produto estão detalhadas nas fotos e na descrição do anúncio. Se precisar de mais informações, é só perguntar!';
    return 'Olá! Obrigado pelo seu interesse. Pode nos enviar mais detalhes sobre sua dúvida? Estamos aqui para ajudar e garantir a melhor experiência de compra!';
  }

}
