import {
  IsEnum,
  IsArray,
  IsString,
  IsNotEmpty,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

import { FieldType } from '../enums/field-type';

export class FieldDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    enum: FieldType,
    example: FieldType.TEXT,
  })
  @IsNotEmpty()
  @IsEnum(FieldType)
  type: FieldType;

  @ApiProperty()
  @IsArray()
  @ArrayNotEmpty()
  options: (string | number)[];
}

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ type: [FieldDto] })
  @IsArray()
  @IsNotEmpty()
  @Type(() => FieldDto)
  @ValidateNested({ each: true })
  fields: FieldDto[];
}
