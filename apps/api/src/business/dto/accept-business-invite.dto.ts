import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class AcceptBusinessInviteDto {
  @ApiProperty({ description: 'Raw invitation token from email link' })
  @IsString()
  @Length(20, 256)
  token: string;
}
