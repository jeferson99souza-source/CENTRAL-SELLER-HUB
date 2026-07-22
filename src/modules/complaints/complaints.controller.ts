import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ComplaintsService } from './complaints.service';
import { TenantId } from '../../common/decorators/tenant.decorator';

@ApiTags('complaints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar reclamações do tenant com filtros' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['open', 'pending', 'closed'],
  })
  @ApiQuery({ name: 'marketplace', required: false })
  findAll(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('marketplace') marketplace?: string,
  ) {
    return this.complaintsService.findAll(tenantId, { status, marketplace });
  }

  @Get('urgent')
  @ApiOperation({ summary: 'Listar reclamações com SLA vencendo em 2h' })
  findUrgent(@TenantId() tenantId: string) {
    return this.complaintsService.findUrgent(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar reclamação por ID' })
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.complaintsService.findOne(id, tenantId);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Marcar reclamação como resolvida' })
  resolve(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.complaintsService.resolve(id, tenantId);
  }

  @Get('returns')
  @ApiOperation({ summary: 'Listar devoluções' })
  findReturns(@TenantId() tenantId: string) {
    return this.complaintsService.findReturns(tenantId);
  }

  @Patch(':id/stage')
  @ApiOperation({ summary: 'Atualizar etapa da devolução' })
  updateStage(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body('stage') stage: string,
  ) {
    return this.complaintsService.updateStage(id, tenantId, stage as any);
  }

  @Patch(':id/notes')
  @ApiOperation({ summary: 'Atualizar notas/próximos passos' })
  updateNotes(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body('notes') notes: string,
  ) {
    return this.complaintsService.updateNotes(id, tenantId, notes);
  }
}
