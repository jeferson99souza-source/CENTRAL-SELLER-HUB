import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  @ApiQuery({ name: 'status', required: false, enum: ['unanswered', 'answered', 'closed_unanswered'] })
  findAll(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.questionsService.findAll(tenantId, status);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Listar perguntas sem resposta' })
  findPending(@TenantId() tenantId: string) {
    return this.questionsService.findPending(tenantId);
  }
}
