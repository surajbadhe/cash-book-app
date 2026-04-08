import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DashboardReportDto } from './dto/dashboard-report.dto';
import { ExpensesByCategoryDto } from './dto/expenses-by-category.dto';
import { ReportService } from './report.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get mobile dashboard report' })
  async dashboard(@CurrentUser('sub') userId: string, @Query() query: DashboardReportDto, @Headers('x-business-id') businessId?: string) {
    const report = await this.reportService.getDashboardReport(userId, query.date, businessId);
    return {
      success: true,
      message: 'Dashboard report retrieved successfully',
      data: report,
    };
  }

  @Get('expenses-by-category')
  @ApiOperation({ summary: 'Get category-wise expense analysis' })
  async expensesByCategory(
    @CurrentUser('sub') userId: string,
    @Query() query: ExpensesByCategoryDto,
    @Headers('x-business-id') businessId?: string,
  ) {
    const report = await this.reportService.getExpensesByCategory(userId, query.from, query.to, businessId);
    return {
      success: true,
      message: 'Expense analysis retrieved successfully',
      data: report,
    };
  }
}
