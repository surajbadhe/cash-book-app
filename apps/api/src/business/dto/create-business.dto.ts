import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsPhoneNumber, IsString, Length, Matches } from 'class-validator';
import { BusinessType } from '../schemas/business.schema';

export class CreateBusinessDto {
  @ApiProperty({ example: 'Spice Route Cafe' })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiPropertyOptional({ enum: BusinessType, default: BusinessType.RESTAURANT })
  @IsOptional()
  @IsEnum(BusinessType)
  type?: BusinessType;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: '+91-9999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Pune' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  address?: string;
}
