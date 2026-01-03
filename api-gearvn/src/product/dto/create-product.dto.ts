import {
  Min,
  IsString,
  IsNumber,
  IsObject,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  discountPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  discountPercent?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  @Type(() => Object)
  attributes: Record<string, any>;

  @ApiProperty({
    default: 0,
    minimum: 0,
  })
  @Min(0)
  @IsNumber()
  @Type(() => Number)
  stock: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  event?: string;
}
