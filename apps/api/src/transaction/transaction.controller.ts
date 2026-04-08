import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  async list(@CurrentUser('sub') userId: string, @Query() query: ListTransactionsDto) {
    const result = await this.transactionService.listForCurrentUser(userId, query);
    return {
      success: true,
      message: 'Transactions retrieved successfully',
      data: result,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create transaction' })
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateTransactionDto) {
    const transaction = await this.transactionService.createForCurrentUser(userId, dto);
    return {
      success: true,
      message: 'Transaction created successfully',
      data: transaction,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update transaction' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    const transaction = await this.transactionService.updateForCurrentUser(userId, id, dto);
    return {
      success: true,
      message: 'Transaction updated successfully',
      data: transaction,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete transaction' })
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const transaction = await this.transactionService.deleteForCurrentUser(userId, id);
    return {
      success: true,
      message: 'Transaction deleted successfully',
      data: transaction,
    };
  }
}
