import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';

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
      vnp_TxnRef: this.buildVnpayTxnRef(dto.orderId),
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

  private buildVnpayTxnRef(orderId: string): string {
    return `${orderId}_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  private parseOrderIdFromVnpayTxnRef(txnRef: string): string {
    return txnRef.split('_')[0];
  }

  private statusFromPersistedOrder(
    order: Pick<Order, 'paymentStatus'> | null,
    responseCode: string,
  ): 'success' | 'pending' | 'failed' {
    if (order?.paymentStatus === PAYMENT_STATUS.PAID) return 'success';
    if (responseCode === '00') return 'pending';
    return this.mapReconciliationStatus(responseCode);
  }

  async reconcileVnpayReturn(query: any) {
    const txnRef = String(query?.vnp_TxnRef ?? '').trim();
    const orderId = this.parseOrderIdFromVnpayTxnRef(txnRef);
    const responseCode = String(query?.vnp_ResponseCode ?? '').trim();
    const providerReference = String(
      query?.vnp_TransactionNo ?? query?.vnp_BankTranNo ?? '',
    ).trim();

    if (!txnRef) {
      throw new BadRequestException('Missing transaction reference');
    }

    const order = await this.orderModel.findById(orderId).lean();
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const isSignatureValid = this.validateReturnQuery(query);
    if (!isSignatureValid) {
      await this.orderModel.findByIdAndUpdate(orderId, {
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

    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      return {
        status: 'success',
        orderId,
        vnpResponseCode: responseCode,
        replay: true,
      };
    }

    const metadata = {
      paymentProvider: 'VNPAY',
      paymentReference: providerReference || undefined,
      paymentResponseCode: responseCode,
      paymentAmount: rawAmount / 100,
      paymentSignatureValid: true,
    };

    if (responseCode !== '00') {
      const updateResult = await this.orderModel.findOneAndUpdate(
        {
          _id: orderId,
          paymentStatus: { $ne: PAYMENT_STATUS.PAID },
        },
        {
          $set: metadata,
        },
        { new: true },
      );

      if (!updateResult) {
        const latestOrder = await this.orderModel.findById(orderId).lean();
        return {
          status: this.statusFromPersistedOrder(latestOrder ?? order, responseCode),
          orderId,
          vnpResponseCode: responseCode,
          replay: true,
        };
      }

      return {
        status: this.statusFromPersistedOrder(updateResult, responseCode),
        orderId,
        vnpResponseCode: responseCode,
        replay: false,
      };
    }

    const updateResult = await this.orderModel.findOneAndUpdate(
      {
        _id: orderId,
        paymentStatus: PAYMENT_STATUS.PENDING,
      },
      {
        $set: {
          ...metadata,
          paymentStatus: PAYMENT_STATUS.PAID,
          paymentReconciledAt: new Date(),
        },
      },
      { new: true },
    );

    if (!updateResult) {
      const latestOrder = await this.orderModel.findById(orderId).lean();
      return {
        status: this.statusFromPersistedOrder(latestOrder ?? order, responseCode),
        orderId,
        vnpResponseCode: responseCode,
        replay: true,
      };
    }

    await this.orderService.applyInventoryTransition(
      orderId,
      'COMMITTED',
      'payment:vnpayReturn',
    );

    return {
      status: this.statusFromPersistedOrder(updateResult, responseCode),
      orderId,
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
