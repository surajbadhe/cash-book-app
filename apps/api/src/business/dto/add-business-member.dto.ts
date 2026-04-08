import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { BusinessMemberRole } from '../schemas/business.schema';

export class AddBusinessMemberDto {
  @ApiProperty({ example: 'employee@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: BusinessMemberRole, default: BusinessMemberRole.EMPLOYEE })
  @IsOptional()
  @IsEnum(BusinessMemberRole)
  role?: BusinessMemberRole;
}
