import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { QuestionsService } from './questions.service';
import { TenantId } from '../../common/decorators/tenant.decorator';

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar perguntas' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['unanswered', 'answered', 'closed_unanswered'],
  })
  findAll(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.questionsService.findAll(tenantId, status);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Listar perguntas sem resposta' })
  findPending(@TenantId() tenantId: string) {
    return this.questionsService.findPending(tenantId);
  }

  @Post(':id/answer')
  @ApiOperation({ summary: 'Responder pergunta via API do Mercado Livre' })
  @ApiBody({
    schema: { properties: { text: { type: 'string' } }, required: ['text'] },
  })
  answerQuestion(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body('text') text: string,
  ) {
    return this.questionsService.answerQuestion(tenantId, id, text);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Dispensar pergunta (ocultar localmente)' })
  dismissQuestion(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.questionsService.dismissQuestion(tenantId, id);
  }

  @Post(':id/block-buyer')
  @ApiOperation({ summary: 'Bloquear comprador no ML e dispensar pergunta' })
  blockBuyer(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.questionsService.blockBuyer(tenantId, id);
  }

  @ApiOperation({
    summary:
      'ROBÔ: apaga no ML as perguntas sem resposta anteriores a uma data (confirm=false apenas conta)',
  })
  @ApiQuery({ name: 'before', description: 'Data ISO. Ex: 2026-10-01' })
  @ApiQuery({ name: 'confirm', required: false })
  @Post('bulk-delete')
  bulkDelete(
    @TenantId() tenantId: string,
    @Query('before') before: string,
    @Query('confirm') confirm?: string,
  ) {
    const date = new Date(before);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Data inválida. Use o formato 2026-10-01.');
    }
    return this.questionsService.bulkDeleteOldInML(
      tenantId,
      date,
      confirm === 'true',
    );
  }

  @Post(':id/ai-suggest')
  @ApiOperation({ summary: 'Obter sugestão de resposta via IA' })
  aiSuggest(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.questionsService.aiSuggest(tenantId, id);
  }
}
