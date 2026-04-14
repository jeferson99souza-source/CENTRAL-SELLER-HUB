import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { TenantId } from '../../common/decorators/tenant.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs em tempo real por período (cache Redis 60s)' })
  @ApiQuery({ name: 'period', required: false, enum: ['24h', '7d', '30d'] })
  getKPIs(
    @TenantId() tenantId: string,
    @Query('period') period: '24h' | '7d' | '30d' = '24h',
  ) {
    return this.dashboardService.getKPIs(tenantId, period);
  }
}
