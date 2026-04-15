import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Complaint } from './entities/complaint.entity';

function calcularSLA(tipo: 'reclamacao' | 'pos_venda' | 'pergunta'): Date {
  const horas = { reclamacao: 24, pos_venda: 48, pergunta: 12 };
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + horas[tipo]);
  return deadline;
}

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
  ) {}

  async findAll(
    tenantId: string,
    filters: { status?: string; marketplace?: string; lastId?: string; limit?: number } = {},
  ): Promise<Complaint[]> {
    const { status, marketplace, lastId, limit = 20 } = filters;

    const qb = this.complaintRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .orderBy('c.slaDeadline', 'ASC')
      .take(limit);

    if (status) qb.andWhere('c.status = :status', { status });
    if (marketplace) qb.andWhere('c.marketplace = :marketplace', { marketplace });
    if (lastId) qb.andWhere('c.id > :lastId', { lastId });

    return qb.getMany();
  }

  async findOne(id: string, tenantId: string): Promise<Complaint> {
    const complaint = await this.complaintRepo.findOne({ where: { id, tenantId } });
    if (!complaint) throw new NotFoundException(`Reclamação ${id} não encontrada.`);
    return complaint;
  }

  async findUrgent(tenantId: string): Promise<Complaint[]> {
    const twoHoursFromNow = new Date();
    twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2);

    return this.complaintRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.status = :status', { status: 'open' })
      .andWhere('c.slaDeadline <= :deadline', { deadline: twoHoursFromNow })
      .orderBy('c.slaDeadline', 'ASC')
      .getMany();
  }

  async findOverdueSla(tenantId: string): Promise<Complaint[]> {
    return this.complaintRepo.find({
      where: { tenantId, status: 'open', slaDeadline: LessThan(new Date()) },
    });
  }

  async create(data: Partial<Complaint>): Promise<Complaint> {
    const complaint = this.complaintRepo.create({
      ...data,
      slaDeadline: calcularSLA('reclamacao'),
    });
    return this.complaintRepo.save(complaint);
  }

  async resolve(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.complaintRepo.update(
      { id, tenantId },
      { status: 'closed', resolvedAt: new Date() },
    );
  }

  async findReturns(tenantId: string): Promise<Complaint[]> {
    return this.complaintRepo.find({
      where: { tenantId, isReturn: true },
      order: { slaDeadline: 'ASC' },
    });
  }

  async updateStage(id: string, tenantId: string, stage: Complaint['stage']): Promise<Complaint> {
    const complaint = await this.findOne(id, tenantId);
    const updates: Partial<Complaint> = { stage };
    if (stage === 'resolved' || stage === 'refunded') {
      updates.status = 'closed';
      updates.resolvedAt = new Date();
    }
    await this.complaintRepo.update({ id, tenantId }, updates);
    return this.findOne(id, tenantId);
  }

  async updateNotes(id: string, tenantId: string, notes: string): Promise<Complaint> {
    await this.findOne(id, tenantId);
    await this.complaintRepo.update({ id, tenantId }, { notes });
    return this.findOne(id, tenantId);
  }
}
