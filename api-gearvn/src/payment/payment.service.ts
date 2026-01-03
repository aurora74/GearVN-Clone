import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OrderService } from 'src/order/order.service';
import { ProductService } from 'src/product/product.service';

import { sortObject } from './helper/sort-object';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { buildSecureHash } from './helper/build-secure-hash';

@Injectable()
export class PaymentService {
  constructor(
    private config: ConfigService,
    private orderService: OrderService,
    private productService: ProductService,
  ) {}

  createPaymentUrl(dto: CreatePaymentDto, ip: string): string {
    const vnpUrl = this.config.get<string>('vnpay.url');
    const tmnCode = this.config.get<string>('vnpay.tmnCode');
    const returnUrl = this.config.get<string>('vnpay.returnUrl');
    const secretKey = this.config.get<string>('vnpay.hashSecret');

    const date = new Date();
    const createDate = date
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);

    const vnp_Params: Record<string, string> = {
      vnp_IpAddr: ip,
      vnp_Locale: 'vn',
      vnp_Command: 'pay',
      vnp_CurrCode: 'VND',
      vnp_Version: '2.1.0',
      vnp_TmnCode: tmnCode!,
      vnp_OrderType: 'other',
      vnp_TxnRef: dto.orderId,
      vnp_ReturnUrl: returnUrl!,
      vnp_CreateDate: createDate,
      vnp_OrderInfo: dto.orderInfo,
      vnp_Amount: (dto.amount * 100).toString(),
    };

    const sortedParams = sortObject(vnp_Params);
    const secureHash = buildSecureHash(secretKey!, sortedParams);

    const query = new URLSearchParams(sortedParams);
    query.append('vnp_SecureHash', secureHash);

    return `${vnpUrl}?${query.toString()}`;
  }

  async vnpayReturn(query: any) {
    const isValid = this.validateReturnQuery(query);
    if (!isValid) {
      throw new BadRequestException('Invalid signature');
    }

    const { vnp_ResponseCode, vnp_TxnRef } = query;

    const order = await this.orderService.findOne(vnp_TxnRef);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (vnp_ResponseCode === '00') {
      await this.orderService.updateOrderPaymentStatus(vnp_TxnRef, 'PAID');

      for (const item of order.items) {
        await this.productService.decreaseStock(item.productId, item.quantity);
        await this.productService.increaseSoldQuantity(
          item.productId,
          item.quantity,
        );
      }

      return {
        status: 'success',
        orderId: vnp_TxnRef,
        vnpResponseCode: vnp_ResponseCode,
      };
    }

    return {
      status: 'fail',
      orderId: vnp_TxnRef,
      vnpResponseCode: vnp_ResponseCode,
    };
  }

  validateReturnQuery(query: any): boolean {
    const secretKey = this.config.get<string>('vnpay.hashSecret');
    const { vnp_SecureHash, ...rest } = query;

    const sorted = sortObject(rest);
    const calculatedHash = buildSecureHash(secretKey!, sorted);

    return vnp_SecureHash === calculatedHash;
  }
}
