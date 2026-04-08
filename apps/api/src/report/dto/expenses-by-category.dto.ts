import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class ExpensesByCategoryDto {
  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsDateString()
  from: string;

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsDateString()
  to: string;
}
