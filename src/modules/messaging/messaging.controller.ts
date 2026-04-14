import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { MessagingService } from './messaging.service';

@ApiTags('messaging')
@UseGuards(TenantGuard)
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @ApiOperation({ summary: 'Listar mensagens de um pedido (cursor-based)' })
  @ApiQuery({ name: 'lastId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('orders/:orderId/messages')
  findByOrder(
    @TenantId() tenantId: string,
    @Param('orderId') orderId: string,
    @Query('lastId') lastId?: string,
    @Query('limit') limit = 50,
  ) {
    return this.messagingService.findByOrder(tenantId, orderId, lastId, +limit);
  }

  @ApiOperation({ summary: 'Listar mensagens pendentes de resposta' })
  @Get('pending')
  findPending(@TenantId() tenantId: string) {
    return this.messagingService.findPending(tenantId);
  }

  @ApiOperation({ summary: 'Marcar mensagem como respondida' })
  @Patch(':id/replied')
  markAsReplied(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.messagingService.markAsReplied(tenantId, id);
  }
}
