import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionService } from './transaction.service';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @ApiOperation({ summary: 'List business transactions' })
  async list(@CurrentUser('sub') userId: string, @Query() query: ListTransactionsDto, @Headers('x-business-id') businessId?: string) {
    const result = await this.transactionService.listForCurrentUser(userId, query, businessId);
    return {
      success: true,
      message: 'Transactions retrieved successfully',
      data: result,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create transaction' })
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateTransactionDto, @Headers('x-business-id') businessId?: string) {
    const transaction = await this.transactionService.createForCurrentUser(userId, dto, businessId);
    return {
      success: true,
      message: 'Transaction created successfully',
      data: transaction,
    };
  }

  @Post('import')
  @ApiOperation({ summary: 'Bulk import transactions from CSV/TSV file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importFile(@CurrentUser('sub') userId: string, @UploadedFile() file: any, @Headers('x-business-id') businessId?: string) {
    const result = await this.transactionService.importForCurrentUser(userId, file, businessId);
    return {
      success: true,
      message: 'Transactions imported successfully',
      data: result,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update transaction' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
    @Headers('x-business-id') businessId?: string,
  ) {
    const transaction = await this.transactionService.updateForCurrentUser(userId, id, dto, businessId);
    return {
      success: true,
      message: 'Transaction updated successfully',
      data: transaction,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete transaction' })
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string, @Headers('x-business-id') businessId?: string) {
    const transaction = await this.transactionService.deleteForCurrentUser(userId, id, businessId);
    return {
      success: true,
      message: 'Transaction deleted successfully',
      data: transaction,
    };
  }

  @Post('bulk-delete')
  @ApiOperation({ summary: 'Bulk soft delete transactions' })
  async bulkDelete(@CurrentUser('sub') userId: string, @Body() body: { ids: string[] }, @Headers('x-business-id') businessId?: string) {
    const result = await this.transactionService.bulkDeleteForCurrentUser(userId, body.ids, businessId);
    return {
      success: true,
      message: `${result.deletedCount} transaction(s) deleted successfully`,
      data: result,
    };
  }
}
