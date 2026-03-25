import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProductStockDto {
  @ApiProperty({ minimum: 0, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock: number;
}
