import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { BusinessMemberRole } from '../schemas/business.schema';

export class CreateBusinessInviteDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: [BusinessMemberRole.ADMIN, BusinessMemberRole.EDITOR, BusinessMemberRole.VIEWER], default: BusinessMemberRole.VIEWER })
  @IsOptional()
  @IsEnum(BusinessMemberRole)
  role?: BusinessMemberRole;
}
