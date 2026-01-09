import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AccountActionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}
