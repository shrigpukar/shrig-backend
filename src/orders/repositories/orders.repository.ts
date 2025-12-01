import { Model } from 'mongoose';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { QueryOrderDto } from 'src/orders/dtos/query-order.dto';
import { CreateOrderDto } from 'src/orders/dtos/create-order.dto';
import { Order, OrderDocument } from 'src/orders/schemas/order.schema';
import { OrderStatus } from 'src/orders/types/order.types';
import {
  pagination,
  PaginationOptions,
} from 'src/common/utils/pagination.util';

export class OrderRepository {
  private logger = new Logger(OrderRepository.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async findAll(query: QueryOrderDto) {
    const { status, sortBy = 'createdAt', sortOrder = 'DESC' } = query;

    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    const sort: any = {};
    sort[sortBy] = sortOrder === 'DESC' ? -1 : 1;

    return await pagination(
      this.orderModel,
      filter,
      query as PaginationOptions,
      this.transformOrder,
      sort,
    );
  }

  async findById(id: string) {
    const order = await this.orderModel.findById(id).lean();
    return order ? this.transformOrder(order) : null;
  }

  async search(searchTerm: string, query: QueryOrderDto) {
    return await pagination(
      this.orderModel,
      {
        $text: { $search: searchTerm },
      },
      query as PaginationOptions,
      this.transformOrder,
      { createdAt: -1 },
    );
  }

  async create(orderData: CreateOrderDto): Promise<Order> {
    const order = new this.orderModel({
      ...orderData,
      totalAmount: orderData.quantity * orderData.price,
    });

    const savedOrder = await order.save();
    return this.transformOrder(savedOrder.toObject());
  }

  async createBatch(orders: CreateOrderDto[]) {
    const session = await this.orderModel.startSession();

    try {
      session.startTransaction();

      const orderDocs = orders.map((order) => ({
        ...order,
        totalAmount: order.quantity * order.price,
      }));

      const savedOrders = await this.orderModel.insertMany(orderDocs, {
        session,
      });

      await session.commitTransaction();

      return savedOrders.map((order) => this.transformOrder(order));
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Error creating batch orders:', error);
      throw new HttpException(
        'Failed to create batch orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await session.endSession();
    }
  }

  async getStats() {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          processingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] },
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'shipped'] }, 1, 0] },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
        },
      },
    ];

    const dailyStatsPipeline = [
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
      {
        $sort: { _id: -1 as -1 },
      },
    ];

    const [statsResult, dailyResult] = await Promise.all([
      this.orderModel.aggregate(pipeline),
      this.orderModel.aggregate(dailyStatsPipeline),
    ]);

    const stats = statsResult[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      avgOrderValue: 0,
      pendingOrders: 0,
      processingOrders: 0,
      shippedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
    };

    return {
      totalOrders: stats.totalOrders,
      totalRevenue: stats.totalRevenue,
      avgOrderValue: stats.avgOrderValue,
      ordersByStatus: {
        [OrderStatus.PENDING]: stats.pendingOrders,
        [OrderStatus.PROCESSING]: stats.processingOrders,
        [OrderStatus.SHIPPED]: stats.shippedOrders,
        [OrderStatus.DELIVERED]: stats.deliveredOrders,
        [OrderStatus.CANCELLED]: stats.cancelledOrders,
      },
      dailyOrders: dailyResult.map((row) => ({
        date: row._id,
        count: row.value,
        revenue: row.value,
      })),
    };
  }

  private transformOrder(order: any): Order {
    return {
      id: order._id?.toString() || order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      productName: order.productName,
      quantity: order.quantity,
      price: order.price,
      totalAmount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    } as Order;
  }
}
