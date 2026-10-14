import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { MessagingService } from './messaging.service';

@ApiTags('messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
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

  @ApiOperation({ summary: 'Listar todas as mensagens (pendentes primeiro)' })
  @Get('all')
  findAll(@TenantId() tenantId: string) {
    return this.messagingService.findAll(tenantId);
  }

  @ApiOperation({ summary: 'Buscar thread completo por packId' })
  @Get('packs/:packId')
  findByPack(@TenantId() tenantId: string, @Param('packId') packId: string) {
    return this.messagingService.findByPack(tenantId, packId);
  }

  @ApiOperation({ summary: 'Responder mensagem via API do marketplace' })
  @ApiBody({
    schema: { properties: { text: { type: 'string' } }, required: ['text'] },
  })
  @Post(':id/reply')
  replyToMessage(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body('text') text: string,
  ) {
    return this.messagingService.replyToMessage(tenantId, id, text);
  }

  @ApiOperation({
    summary: 'Contar/apagar mensagens antigas (confirm=false apenas conta)',
  })
  @ApiQuery({ name: 'before', description: 'Data ISO. Ex: 2026-10-01' })
  @ApiQuery({ name: 'confirm', required: false })
  @Post('cleanup')
  cleanupOld(
    @TenantId() tenantId: string,
    @Query('before') before: string,
    @Query('confirm') confirm?: string,
  ) {
    const date = new Date(before);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Data inválida. Use o formato 2026-10-01.');
    }
    return this.messagingService.cleanupOld(tenantId, date, confirm === 'true');
  }

  @ApiOperation({
    summary: 'Sugerir resposta com IA (no estilo das respostas do vendedor)',
  })
  @Post(':id/ai-suggest')
  aiSuggest(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.messagingService.aiSuggest(tenantId, id);
  }

  @ApiOperation({ summary: 'Marcar mensagem como respondida' })
  @Patch(':id/replied')
  markAsReplied(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.messagingService.markAsReplied(tenantId, id);
  }
}
