import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { BusinessMemberRole } from '../schemas/business.schema';

export class UpdateBusinessMemberDto {
  @ApiProperty({ enum: BusinessMemberRole })
  @IsEnum(BusinessMemberRole)
  role: BusinessMemberRole;
}
