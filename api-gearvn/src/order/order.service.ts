import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';

import { Order, OrderDocument } from './order.schema';

import { CreateOrderDto } from './dto/create-order.dto';

import { OrderStatus } from './enums/order-status';
import { PaymentStatus } from './enums/payment-status';
import { ProductService } from 'src/product/product.service';
import { ORDER_STATUS, PAYMENT_STATUS } from 'src/config.global';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private productService: ProductService,
  ) {}

  async create(dto: CreateOrderDto, userId: string) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await this.orderModel.countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lt: new Date(today.setHours(23, 59, 59, 999)),
      },
    });

    const orderCode = `DH${dateStr}-${(countToday + 1)
      .toString()
      .padStart(4, '0')}`;

    const orderData: Partial<Order> = {
      userId,
      orderCode,
      note: dto.note,
      items: dto.items,
      phone: dto.phone,
      address: dto.address,
      fullName: dto.fullName,
      totalAmount: dto.totalAmount,
      paymentMethod: dto.paymentMethod,
      orderStatus: ORDER_STATUS.PROCESSING,
      paymentStatus: PAYMENT_STATUS.PENDING,
    };

    const createdOrder = new this.orderModel(orderData);
    return createdOrder.save();
  }

  async updateOrderPaymentStatus(
    orderId: string,
    status: 'PAID' | 'CANCELLED' | 'PENDING',
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.paymentStatus = status;
    return await order.save();
  }

  async findMyOrders(
    userId: string,
    {
      page = 1,
      limit = 10,
      search,
      sortBy = '-createdAt',
      fields,
      orderStatus,
    }: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
      fields?: string;
      orderStatus?: string;
    },
  ) {
    const query: any = { userId };

    if (orderStatus) {
      query.orderStatus = orderStatus;
    }

    if (search) {
      if (Types.ObjectId.isValid(search) && search.length === 24) {
        query._id = new Types.ObjectId(search);
      } else {
        query.orderCode = { $regex: search, $options: 'i' };
      }
    }

    let projection = {};
    if (fields) {
      projection = fields.split(',').reduce((acc, field) => {
        acc[field.trim()] = 1;
        return acc;
      }, {} as any);
    }

    const total = await this.orderModel.countDocuments(query);

    const data = await this.orderModel
      .find(query, projection)
      .populate({
        path: 'items.productId',
        select: '-description',
      })
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  async findOrders({
    page = 1,
    limit = 10,
    search,
    sortBy = '-createdAt',
    fields,
    orderStatus,
    paymentStatus,
    paymentMethod,
    totalFrom,
    totalTo,
    dateFrom,
    dateTo,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    fields?: string;
    orderStatus?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    totalFrom?: number;
    totalTo?: number;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const query: any = {};

    if (orderStatus) query.orderStatus = { $in: orderStatus.split(',') };
    if (paymentStatus) query.paymentStatus = { $in: paymentStatus.split(',') };
    if (paymentMethod) query.paymentMethod = { $in: paymentMethod.split(',') };

    if (search) {
      if (Types.ObjectId.isValid(search) && search.length === 24) {
        query._id = new Types.ObjectId(search);
      } else {
        query.orderCode = { $regex: search, $options: 'i' };
      }
    }

    if (totalFrom != null || totalTo != null) {
      query.totalAmount = {};
      if (totalFrom != null) query.totalAmount.$gte = totalFrom;
      if (totalTo != null) query.totalAmount.$lte = totalTo;
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    let projection: any = {};
    if (fields) {
      projection = fields.split(',').reduce((acc, field) => {
        acc[field.trim()] = 1;
        return acc;
      }, {});
    }

    const total = await this.orderModel.countDocuments(query);

    const data = await this.orderModel
      .find(query, projection)
      .populate({ path: 'userId', select: 'email avatarUrl' })
      .populate({ path: 'items.productId', select: '-description' })
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  async findOne(id: string) {
    const order = await this.orderModel
      .findById(id)
      .populate('items.productId')
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async findByCode(code: string) {
    const order = await this.orderModel
      .findOne({ orderCode: code })
      .populate('items.productId')
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateStatus(id: string, status: OrderStatus) {
    const updateData: Partial<Order> = { orderStatus: status };

    if (status === OrderStatus.COMPLETED) {
      updateData.paymentStatus = PaymentStatus.PAID;
    }

    if (status === OrderStatus.CANCELLED) {
      updateData.paymentStatus = PaymentStatus.CANCELLED;
    }

    const updatedOrder = await this.orderModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    );

    if (!updatedOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (status === OrderStatus.COMPLETED) {
      for (const item of updatedOrder.items) {
        await this.productService.decreaseStock(item.productId, item.quantity);
        await this.productService.increaseSoldQuantity(
          item.productId,
          item.quantity,
        );
      }
    }

    return updatedOrder;
  }

  async cancelOrder(id: string) {
    const cancelledOrder = await this.orderModel.findByIdAndUpdate(
      id,
      {
        orderStatus: ORDER_STATUS.CANCELLED,
        paymentStatus: PAYMENT_STATUS.CANCELLED,
      },
      { new: true },
    );

    if (!cancelledOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return cancelledOrder;
  }

  async getTotalRevenue(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          orderStatus: OrderStatus.COMPLETED,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
        },
      },
    ]);

    return result.length > 0 ? result[0].total : 0;
  }

  async getRevenueGrowth(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date,
  ): Promise<number> {
    const currentRevenue = await this.getTotalRevenue(currentStart, currentEnd);
    const previousRevenue = await this.getTotalRevenue(
      previousStart,
      previousEnd,
    );

    if (previousRevenue === 0) return currentRevenue > 0 ? 1 : 0;

    return (currentRevenue - previousRevenue) / previousRevenue;
  }

  async getOrdersCount(startDate: Date, endDate: Date): Promise<number> {
    return this.orderModel
      .countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        orderStatus: OrderStatus.COMPLETED,
      })
      .exec();
  }

  async getOrdersGrowth(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date,
  ): Promise<number> {
    const currentCount = await this.getOrdersCount(currentStart, currentEnd);
    const previousCount = await this.getOrdersCount(previousStart, previousEnd);

    if (previousCount === 0) return 1;

    return (currentCount - previousCount) / previousCount;
  }

  async getSalesAndOrdersByDate(startDate: Date, endDate: Date) {
    const result = await this.orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          orderStatus: {
            $in: [
              OrderStatus.PROCESSING,
              OrderStatus.SHIPPING,
              OrderStatus.COMPLETED,
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          sales: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          sales: 1,
          orders: 1,
        },
      },
    ]);

    return result;
  }
}
