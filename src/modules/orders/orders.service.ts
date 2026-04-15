import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  findAll(tenantId: string, status?: string): Promise<Order[]> {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.orderRepo.find({ where, order: { orderDate: 'DESC' } });
  }

  findOne(tenantId: string, id: string): Promise<Order | null> {
    return this.orderRepo.findOne({ where: { id, tenantId } });
  }
}
