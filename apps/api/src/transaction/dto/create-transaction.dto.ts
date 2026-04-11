import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { CategoryType } from '../../category/schemas/category.schema';
import { TransactionSource } from '../schemas/transaction.schema';

export class CreateTransactionDto {
  @ApiProperty({ enum: CategoryType, example: CategoryType.CASH_IN })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty({ example: 1450 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'cat_food_sales' })
  @IsString()
  categoryId: string;

  @ApiProperty({ example: '2026-04-07T13:30:00.000Z' })
  @IsDateString()
  occurredAt: string;

  @ApiPropertyOptional({ example: 'Lunch rush' })
  @IsOptional()
  @IsString()
  @Length(1, 300)
  note?: string;

  @ApiPropertyOptional({ example: 'Walk-in' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  party?: string;

  @ApiPropertyOptional({ example: 'UPI' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  mode?: string;

  @ApiPropertyOptional({ example: 'Owner' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  entryBy?: string;

  @ApiPropertyOptional({ enum: TransactionSource, default: TransactionSource.MANUAL })
  @IsOptional()
  @IsEnum(TransactionSource)
  source?: TransactionSource;

  @ApiPropertyOptional({ example: 'device-123' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ example: 'local-txn-1' })
  @IsOptional()
  @IsString()
  localRef?: string;
}
