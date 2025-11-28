import { Model } from 'mongoose';
import { QueryOrderDto } from './dto/query-order.dto';
import { Order, OrderDocument } from './schemas/order.schema';
import { Logger } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './types/order.types';
import { InjectModel } from '@nestjs/mongoose';

export class OrderRepository {
  private logger = new Logger(OrderRepository.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async findAll(query: QueryOrderDto) {
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = query;

    const skip = (page - 1) * limit;
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    const sort: any = {};
    sort[sortBy] = sortOrder === 'DESC' ? -1 : 1;

    try {
      const [data, total] = await Promise.all([
        this.orderModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
        this.orderModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: data.map(this.transformOrder),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching orders:', error);
      throw error;
    }
  }

  async findById(id: string) {
    try {
      const order = await this.orderModel.findById(id).lean();
      return order ? this.transformOrder(order) : null;
    } catch (error) {
      this.logger.error('Error fetching order by ID:', error);
      throw error;
    }
  }

  async search(searchTerm: string, pagination: QueryOrderDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    try {
      const [data, total] = await Promise.all([
        this.orderModel
          .find({
            $text: { $search: searchTerm },
          })
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.orderModel.countDocuments({
          $text: { $search: searchTerm },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: data.map(this.transformOrder),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('Error searching orders:', error);
      throw error;
    }
  }

  async create(orderData: CreateOrderDto): Promise<Order> {
    try {
      const order = new this.orderModel({
        ...orderData,
        total_amount: orderData.quantity * orderData.price,
      });

      const savedOrder = await order.save();
      return this.transformOrder(savedOrder.toObject());
    } catch (error) {
      this.logger.error('Error creating order:', error);
      throw error;
    }
  }

  async createBatch(orders: CreateOrderDto[]) {
    const session = await this.orderModel.startSession();

    try {
      session.startTransaction();

      const orderDocs = orders.map((order) => ({
        ...order,
        total_amount: order.quantity * order.price,
      }));

      const savedOrders = await this.orderModel.insertMany(orderDocs, {
        session,
      });

      await session.commitTransaction();

      return savedOrders.map((order) => this.transformOrder(order));
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Error creating batch orders:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getStats() {
    try {
      const pipeline = [
        {
          $group: {
            _id: null,
            total_orders: { $sum: 1 },
            total_revenue: { $sum: '$total_amount' },
            avg_order_value: { $avg: '$total_amount' },
            pending_orders: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
            processing_orders: {
              $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] },
            },
            shipped_orders: {
              $sum: { $cond: [{ $eq: ['$status', 'shipped'] }, 1, 0] },
            },
            delivered_orders: {
              $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
            },
            cancelled_orders: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
          },
        },
      ];

      const dailyStatsPipeline = [
        {
          $match: {
            created_at: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$created_at' },
            },
            count: { $sum: 1 },
            revenue: { $sum: '$total_amount' },
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
        total_orders: 0,
        total_revenue: 0,
        avg_order_value: 0,
        pending_orders: 0,
        processing_orders: 0,
        shipped_orders: 0,
        delivered_orders: 0,
        cancelled_orders: 0,
      };

      return {
        total_orders: stats.total_orders,
        total_revenue: stats.total_revenue,
        avg_order_value: stats.avg_order_value,
        orders_by_status: {
          [OrderStatus.PENDING]: stats.pending_orders,
          [OrderStatus.PROCESSING]: stats.processing_orders,
          [OrderStatus.SHIPPED]: stats.shipped_orders,
          [OrderStatus.DELIVERED]: stats.delivered_orders,
          [OrderStatus.CANCELLED]: stats.cancelled_orders,
        },
        daily_orders: dailyResult.map((row) => ({
          date: row._id,
          count: row.value,
          revenue: row.value,
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching order stats:', error);
      throw error;
    }
  }

  private transformOrder(order: any): Order {
    return {
      id: order._id?.toString() || order.id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      product_name: order.product_name,
      quantity: order.quantity,
      price: order.price,
      total_amount: order.total_amount,
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
    } as Order;
  }
}
