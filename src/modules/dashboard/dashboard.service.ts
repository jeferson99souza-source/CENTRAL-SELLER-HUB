import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export interface DashboardKPIs {
  totalMessages: number;
  totalComplaints: number;
  complaintsSlaBreached: number;
  totalQuestions: number;
  averageResponseTime: number;
  byMarketplace: {
    marketplace: string;
    messages: number;
    complaints: number;
    questions: number;
  }[];
}

/**
 * Serviço de dashboard — agrega KPIs por tenant.
 * Cache Redis com TTL de 60 segundos (implementação futura).
 */
@Injectable()
export class DashboardService {
  async getKPIs(tenantId: string, period: '24h' | '7d' | '30d' = '24h'): Promise<DashboardKPIs> {
    // TODO: implementar queries reais com cache Redis TTL 60s
    return {
      totalMessages: 0,
      totalComplaints: 0,
      complaintsSlaBreached: 0,
      totalQuestions: 0,
      averageResponseTime: 0,
      byMarketplace: [
        { marketplace: 'mercadolivre', messages: 0, complaints: 0, questions: 0 },
        { marketplace: 'shopee', messages: 0, complaints: 0, questions: 0 },
        { marketplace: 'amazon', messages: 0, complaints: 0, questions: 0 },
      ],
    };
  }
}
