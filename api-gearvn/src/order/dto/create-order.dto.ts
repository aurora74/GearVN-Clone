import {
  IsEnum,
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PaymentMethod } from '../enums/payment-method';

class CreateOrderItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  clientFinalPrice?: number;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  voucherCode?: string;

  @ApiProperty({
    type: CreateOrderItemDto,
    isArray: true,
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.COD })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
