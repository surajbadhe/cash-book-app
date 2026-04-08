import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { TransactionModule } from '../transaction/transaction.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [BusinessModule, TransactionModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
