import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { BusinessMemberRole } from '../schemas/business.schema';

export class CreateBusinessInviteDto {
  @ApiProperty({ example: 'employee@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: [BusinessMemberRole.MANAGER, BusinessMemberRole.EMPLOYEE], default: BusinessMemberRole.EMPLOYEE })
  @IsOptional()
  @IsEnum(BusinessMemberRole)
  role?: BusinessMemberRole;
}
