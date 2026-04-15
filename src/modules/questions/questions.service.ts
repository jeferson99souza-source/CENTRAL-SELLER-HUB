import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from './entities/question.entity';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
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
}
