import {
  Get,
  Req,
  Post,
  Body,
  Query,
  UseGuards,
  Controller,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

import { UserRole } from 'src/auth/enums/user-role.enum';
import { Roles } from 'src/auth/decorators/roles.decorator';

@ApiTags('Payments')
@Controller('payment/vnpay')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBody({ type: CreatePaymentDto })
  createPayment(@Body() dto: CreatePaymentDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.ip ||
      (req.socket?.remoteAddress ?? '127.0.0.1');

    const paymentUrl = this.paymentService.createPaymentUrl(dto, ip);
    return { paymentUrl };
  }

  @Get('return')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiQuery({ name: 'vnp_ResponseCode', required: true, type: String })
  @ApiQuery({ name: 'vnp_TxnRef', required: true, type: String })
  async vnpayReturn(@Query() query: any) {
    return this.paymentService.vnpayReturn(query);
  }
}
