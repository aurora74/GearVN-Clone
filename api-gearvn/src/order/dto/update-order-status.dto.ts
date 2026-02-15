import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { OrderStatus } from '../enums/order-status';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  orderStatus: OrderStatus;
}
