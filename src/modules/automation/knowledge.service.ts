import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AnswerTemplate, AnswerSource } from './entities/answer-template.entity';

/** Palavras muito comuns que não ajudam a medir semelhança */
const STOPWORDS = new Set([
  'a','o','as','os','de','da','do','das','dos','e','em','um','uma','uns','umas',
  'para','por','com','sem','que','se','na','no','nas','nos','ao','aos','à','às',
  'eu','voce','você','vcs','meu','minha','seu','sua','ele','ela','isso','isto',
  'é','e','ser','tem','ter','vai','ja','já','mais','muito','bem','boa','bom',
  'ola','olá','oi','obrigado','obrigada','por favor','favor','pode','poderia',
]);

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private client: Anthropic | null = null;

  constructor(
    @InjectRepository(AnswerTemplate)
    private readonly repo: Repository<AnswerTemplate>,
    private readonly config: ConfigService,
  ) {}

  private getClient(): Anthropic | null {
    if (this.client) return this.client;
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) return null;
    this.client = new Anthropic({ apiKey });
    return this.client;
  }

  // ─── 1. Captura ──────────────────────────────────────────────────────────────

  /**
   * Guarda o par "cliente perguntou → vendedor respondeu".
   * Chamado automaticamente sempre que o vendedor responde.
   */
  async capture(params: {
    tenantId: string;
    source: AnswerSource;
    customerText: string;
    sellerAnswer: string;
    itemTitle?: string | null;
  }): Promise<void> {
    const customerText = (params.customerText || '').trim();
    const sellerAnswer = (params.sellerAnswer || '').trim();

    // Só vale a pena guardar respostas com algum conteúdo
    if (!customerText || sellerAnswer.length < 10) return;

    try {
      // Evita duplicar a mesma resposta para a mesma pergunta
      const exists = await this.repo.findOne({
        where: {
          tenantId: params.tenantId,
          customerText,
          sellerAnswer,
        },
      });
      if (exists) return;

      await this.repo.save({
        tenantId: params.tenantId,
        source: params.source,
        customerText,
        sellerAnswer,
        itemTitle: params.itemTitle ?? undefined,
      });
      this.logger.log(
        `Base de conhecimento +1 (${params.source}) para tenant=${params.tenantId}`,
      );
    } catch (err) {
      // Nunca quebra o fluxo de resposta por causa do aprendizado
      this.logger.warn(`Falha ao capturar resposta: ${(err as Error).message}`);
    }
  }

  // ─── 2. Busca de respostas parecidas ────────────────────────────────────────

  /**
   * Procura, entre as respostas já dadas pelo vendedor, as mais parecidas com o
   * texto do cliente. Usa sobreposição de palavras (sem depender de banco
   * vetorial) — simples e suficiente para o volume de uma operação de seller.
   */
  async findSimilar(
    tenantId: string,
    text: string,
    limit = 5,
  ): Promise<AnswerTemplate[]> {
    const wanted = new Set(tokenize(text));
    if (!wanted.size) return [];

    // Pega as mais recentes e pontua em memória
    const recent = await this.repo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 400,
    });

    const scored = recent
      .map((t) => {
        const tokens = new Set(tokenize(t.customerText));
        let hits = 0;
        for (const w of wanted) if (tokens.has(w)) hits++;
        // normaliza pelo tamanho da pergunta nova (0..1)
        const score = hits / wanted.size;
        return { t, score };
      })
      .filter((s) => s.score > 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => s.t);
  }

  // ─── 3. Sugestão com IA (no estilo do vendedor) ─────────────────────────────

  /**
   * Gera uma sugestão de resposta usando as respostas anteriores do vendedor
   * como exemplo. Se não houver API key ou a IA falhar, devolve null para o
   * chamador usar o fallback dele.
   */
  async suggest(params: {
    tenantId: string;
    customerText: string;
    itemTitle?: string | null;
    source: AnswerSource;
  }): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;

    const examples = await this.findSimilar(
      params.tenantId,
      params.customerText,
      5,
    );

    const exemplosTexto = examples.length
      ? examples
          .map(
            (e, i) =>
              `Exemplo ${i + 1}:\nCliente: ${e.customerText}\nVocê respondeu: ${e.sellerAnswer}`,
          )
          .join('\n\n')
      : '(ainda não há respostas anteriores registradas)';

    const contexto = [
      params.itemTitle ? `Produto: ${params.itemTitle}` : null,
      params.source === 'pergunta'
        ? 'Canal: pergunta pré-venda no anúncio'
        : 'Canal: mensagem pós-venda (cliente já comprou)',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await client.messages.create({
        model: 'claude-opus-5',
        max_tokens: 1000,
        // Tarefa curta e com o usuário esperando — prioriza latência
        output_config: { effort: 'low' },
        system:
          'Você escreve respostas para clientes em nome de um vendedor do Mercado Livre, em português do Brasil.\n' +
          'Regras:\n' +
          '- Imite o estilo, o tom e as políticas que aparecem nas respostas anteriores do vendedor.\n' +
          '- Nunca invente política (prazo, garantia, frete, devolução) que não apareça nos exemplos; se não souber, seja cordial e peça/ofereça contato.\n' +
          '- Seja direto: no máximo 3 frases.\n' +
          '- Não use emojis a menos que os exemplos usem.\n' +
          '- Responda APENAS com o texto da resposta, sem aspas e sem explicação.',
        messages: [
          {
            role: 'user',
            content:
              `${contexto}\n\n` +
              `Respostas anteriores deste vendedor (use como referência de estilo e política):\n${exemplosTexto}\n\n` +
              `Agora escreva a resposta para esta nova mensagem do cliente:\n"${params.customerText}"`,
          },
        ],
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();

      if (!text) return null;

      // Marca os exemplos usados (métrica simples de utilidade)
      if (examples.length) {
        await this.repo.increment(
          { id: examples[0].id },
          'useCount',
          1,
        );
      }

      return text;
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        this.logger.warn('IA: rate limit da Anthropic — usando fallback');
      } else if (err instanceof Anthropic.AuthenticationError) {
        this.logger.error('IA: ANTHROPIC_API_KEY inválida');
      } else if (err instanceof Anthropic.APIError) {
        this.logger.warn(`IA: erro ${err.status} — ${err.message}`);
      } else {
        this.logger.warn(`IA falhou: ${(err as Error).message}`);
      }
      return null;
    }
  }

  /** Quantas respostas já foram aprendidas (para mostrar na UI) */
  async count(tenantId: string): Promise<number> {
    return this.repo.count({ where: { tenantId } });
  }
}
