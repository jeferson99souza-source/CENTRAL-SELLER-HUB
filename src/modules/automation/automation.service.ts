import { Injectable, Logger } from '@nestjs/common';

export type MessageClassification =
  | 'reclamacao'
  | 'pos_venda'
  | 'pergunta'
  | 'outro';

const KEYWORDS: Record<MessageClassification, string[]> = {
  reclamacao: [
    'produto com defeito',
    'não chegou',
    'errado',
    'devolver',
    'reembolso',
    'cancelar',
  ],
  pos_venda: [
    'entrega',
    'prazo',
    'codigo de rastreio',
    'onde está',
    'quando chega',
  ],
  pergunta: [
    'tem estoque',
    'disponível',
    'qual o tamanho',
    'aceita',
    'garantia',
  ],
  outro: [],
};

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  /**
   * Classifica uma mensagem com base em palavras-chave.
   * Futuramente: substituir por modelo de ML.
   */
  classifyMessage(text: string): MessageClassification {
    const lower = text.toLowerCase();

    for (const [type, keywords] of Object.entries(KEYWORDS)) {
      if (type === 'outro') continue;
      if (keywords.some((kw) => lower.includes(kw))) {
        return type as MessageClassification;
      }
    }

    return 'outro';
  }

  /**
   * Sugere resposta automática baseada na classificação.
   * Futuramente: chamar LLM (OpenAI/Gemini) para gerar resposta personalizada.
   */
  suggestReply(classification: MessageClassification): string | null {
    const templates: Partial<Record<MessageClassification, string>> = {
      reclamacao:
        'Prezado cliente, lamentamos pelo inconveniente. Vamos analisar sua reclamação em até 24 horas e retornar com uma solução.',
      pos_venda:
        'Olá! Seu pedido está em processamento. Em breve você receberá o código de rastreio por e-mail.',
      pergunta:
        'Olá! Agradecemos seu interesse. Nossa equipe responderá sua dúvida em breve.',
    };

    return templates[classification] || null;
  }

  /**
   * Mensagem automática pós-venda (usada no webhook de orders)
   */
  getWelcomeMessage(buyerName: string): string {
    return `Olá, ${buyerName}! Agradecemos imensamente pela sua compra. O seu pedido já está sendo preparado pela nossa equipe e em breve você receberá o código de rastreamento. Qualquer dúvida, estamos à disposição por aqui!`;
  }
}
