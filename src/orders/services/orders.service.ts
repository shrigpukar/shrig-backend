import {
  HttpStatus,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { QueryOrderDto } from 'src/orders/dtos/query-order.dto';
import { OrderRepository } from 'src/orders/repositories/orders.repository';
import { CreateOrderDto } from 'src/orders/dtos/create-order.dto';

import { CacheService } from 'src/cache/services/cache.service';

@Injectable()
export class OrdersService {
  private logger = new Logger(OrdersService.name);

  private readonly CACHE_KEY = {
    ORDERS_LIST: (query: string) => `orders:list:${query}`,
    ORDER_BY_ID: (id: string) => `order:${id}`,
    ORDER_STATS: 'orders:stats',
    ORDER_SEARCH: (term: string, page: number) =>
      `orders:search:${term}:${page}`,
  };

  constructor(
    private orderRepository: OrderRepository,
    private cacheService: CacheService,
  ) {}

  async getOrders(query: QueryOrderDto) {
    const cacheKey = this.CACHE_KEY.ORDERS_LIST(JSON.stringify(query));

    const cachedResult = await this.cacheService.getMultiLevel(cacheKey);
    if (cachedResult) {
      this.logger.log('Orders retrieved from cache');
      return cachedResult;
    }

    const result = await this.orderRepository.findAll(query);

    return result;
  }

  async getOrderById(id: string) {
    const cacheKey = this.CACHE_KEY.ORDER_BY_ID(id);

    const cachedOrder = await this.cacheService.getMultiLevel(cacheKey);
    if (cachedOrder) {
      return cachedOrder;
    }

    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.cacheService.setMultiLevel(cacheKey, order, 600);

    return order;
  }

  async searchOrders(searchTerm: string, pagination: QueryOrderDto) {
    const cacheKey = this.CACHE_KEY.ORDER_SEARCH(
      searchTerm,
      pagination.page || 1,
    );

    const cachedResult = await this.cacheService.get(cacheKey);
    if (cachedResult) {
      this.logger.log('Orders search retrieved from cache');
      return cachedResult;
    }

    const result = await this.orderRepository.search(searchTerm, pagination);

    if (!result) {
      throw new NotFoundException('Order not found');
    }

    await this.cacheService.set(cacheKey, result, 120);

    return result;
  }

  async createOrder(orderData: CreateOrderDto) {
    const order = await this.orderRepository.create(orderData);

    await this.invalidateOrderCaches();

    return order;
  }

  async createBatchOrders(orders: CreateOrderDto[]) {
    if (orders.length === 0) {
      throw new Error('No orders provided for batch creation');
    }

    if (orders.length > 1000) {
      throw new Error('Batch size too large. Maximum 1000 orders per batch');
    }

    const createdOrders = await this.orderRepository.createBatch(orders);

    await this.invalidateOrderCaches();

    return createdOrders;
  }

  async getOrderStats() {
    try {
      const stats = await this.orderRepository.getStats();
      return stats;
    } catch (error) {
      this.logger.error('Error getting order stats:', error);
      throw new HttpException(
        'Failed to get order stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async warmCache(): Promise<void> {
    try {
      this.logger.log('Starting cache warming...');

      await this.getOrderStats();

      await this.getOrders({ page: 1, limit: 50 });

      this.logger.log('Cache warming completed');
    } catch (error) {
      this.logger.error('Cache warming failed:', error);
      throw new HttpException(
        'Failed to warm cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async invalidateOrderCaches(): Promise<void> {
    try {
      await Promise.all([
        this.cacheService.invalidatePattern('orders:list:*'),
        this.cacheService.invalidatePattern('order:search:*'),
        this.cacheService.del(this.CACHE_KEY.ORDER_STATS),
      ]);
    } catch (error) {
      this.logger.error('Cache invalidation failed:', error);
      throw new HttpException(
        'Failed to invalidate order caches',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
