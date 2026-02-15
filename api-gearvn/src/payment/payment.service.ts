import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { OrderService } from 'src/order/order.service';
import { Permission } from 'src/auth/policy/permissions';
import {
  assertOwnerOrPermission,
  OwnershipActor,
} from 'src/auth/policy/ownership';

import { sortObject } from './helper/sort-object';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { buildSecureHash } from './helper/build-secure-hash';
import { ORDER_STATUS, PAYMENT_STATUS } from 'src/config.global';
import { Order, OrderDocument } from 'src/order/order.schema';

@Injectable()
export class PaymentService {
  constructor(
    private config: ConfigService,
    private orderService: OrderService,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  async createPaymentUrl(
    dto: CreatePaymentDto,
    ip: string,
    actor: OwnershipActor,
  ): Promise<string> {
    const order = await this.orderService.findOne(dto.orderId);

    assertOwnerOrPermission({
      actor,
      ownerId: order.userId,
      permission: Permission.ORDER_MANAGE,
      targetType: 'order payment',
    });

    if (order.orderStatus !== ORDER_STATUS.PROCESSING) {
      throw new BadRequestException('Only processing orders can be paid');
    }

    if (order.paymentStatus !== PAYMENT_STATUS.PENDING) {
      throw new BadRequestException('Order payment is not pending');
    }

    const amount = Number(order.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Order total is invalid');
    }

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
      vnp_Amount: (amount * 100).toString(),
    };

    const sortedParams = sortObject(vnp_Params);
    const secureHash = buildSecureHash(secretKey!, sortedParams);

    const query = new URLSearchParams(sortedParams);
    query.append('vnp_SecureHash', secureHash);

    return `${vnpUrl}?${query.toString()}`;
  }

  private mapReconciliationStatus(responseCode: string): 'success' | 'pending' | 'failed' {
    if (responseCode === '00') return 'success';
    if (['24', '07', '51'].includes(responseCode)) return 'failed';
    return 'pending';
  }

  async reconcileVnpayReturn(query: any) {
    const txnRef = String(query?.vnp_TxnRef ?? '').trim();
    const responseCode = String(query?.vnp_ResponseCode ?? '').trim();
    const providerReference = String(
      query?.vnp_TransactionNo ?? query?.vnp_BankTranNo ?? '',
    ).trim();

    if (!txnRef) {
      throw new BadRequestException('Missing transaction reference');
    }

    const order = await this.orderModel.findById(txnRef).lean();
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const isSignatureValid = this.validateReturnQuery(query);
    if (!isSignatureValid) {
      await this.orderModel.findByIdAndUpdate(txnRef, {
        paymentProvider: 'VNPAY',
        paymentResponseCode: responseCode || 'INVALID_SIGNATURE',
        paymentSignatureValid: false,
      });
      throw new BadRequestException('Invalid signature');
    }

    const rawAmount = Number(query?.vnp_Amount ?? 0);
    const expectedAmount = Math.round(Number(order.totalAmount) * 100);

    if (!Number.isFinite(rawAmount) || rawAmount !== expectedAmount) {
      throw new BadRequestException('VNPay amount does not match order total');
    }

    if (order.paymentReconciledAt) {
      return {
        status: this.mapReconciliationStatus(responseCode),
        orderId: txnRef,
        vnpResponseCode: responseCode,
        replay: true,
      };
    }

    const updateResult = await this.orderModel.findOneAndUpdate(
      {
        _id: txnRef,
        paymentReconciledAt: { $exists: false },
      },
      {
        $set: {
          paymentProvider: 'VNPAY',
          paymentReference: providerReference || undefined,
          paymentResponseCode: responseCode,
          paymentAmount: rawAmount / 100,
          paymentSignatureValid: true,
          paymentReconciledAt: new Date(),
          ...(responseCode === '00' && { paymentStatus: PAYMENT_STATUS.PAID }),
        },
      },
      { new: true },
    );

    if (!updateResult) {
      return {
        status: this.mapReconciliationStatus(responseCode),
        orderId: txnRef,
        vnpResponseCode: responseCode,
        replay: true,
      };
    }

    if (responseCode === '00') {
      await this.orderService.applyInventoryTransition(
        txnRef,
        'COMMITTED',
        'payment:vnpayReturn',
      );
    }
    return {
      status: this.mapReconciliationStatus(responseCode),
      orderId: txnRef,
      vnpResponseCode: responseCode,
      replay: false,
    };
  }

  async vnpayReturn(query: any) {
    return this.reconcileVnpayReturn(query);
  }

  validateReturnQuery(query: any): boolean {
    const secretKey = this.config.get<string>('vnpay.hashSecret');
    const { vnp_SecureHash, ...rest } = query;

    const sorted = sortObject(rest);
    const calculatedHash = buildSecureHash(secretKey!, sorted);

    return vnp_SecureHash === calculatedHash;
  }
}
