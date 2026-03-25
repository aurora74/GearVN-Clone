import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tag: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  endsAt: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}
