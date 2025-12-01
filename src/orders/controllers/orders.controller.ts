import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
} from '@nestjs/common';

import { QueryOrderDto } from 'src/orders/dtos/query-order.dto';
import { OrdersService } from 'src/orders/services/orders.service';
import { CreateOrderDto } from 'src/orders/dtos/create-order.dto';

@Controller('orders')
export class OrdersController {
  private logger = new Logger(OrdersController.name);

  constructor(private ordersService: OrdersService) {}

  @Get()
  async getOrders(@Query() query: QueryOrderDto) {
    try {
      const startTime = Date.now();
      const result = await this.ordersService.getOrders(query);

      const responseTime = Date.now() - startTime;
      this.logger.log(`Orders fetched in ${responseTime}ms`);

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting orders:', error);
      throw new HttpException(
        'Failed to get orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats')
  async getOrdersStats() {
    try {
      const startTime = Date.now();

      const stats = await this.ordersService.getOrderStats();

      const responseTime = Date.now() - startTime;
      this.logger.log(`Order stats fetched in ${responseTime}ms`);

      const response = {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
      return response;
    } catch (error) {
      this.logger.error('Error getting order stats:', error);
      throw new HttpException(
        'Failed to get order stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('search')
  async searchOrders(
    @Query('q') searchTerm: string,
    @Query() query: QueryOrderDto,
  ) {
    try {
      const startTime = Date.now();

      if (!searchTerm) {
        const response = {
          success: false,
          message: 'Search term is required',
          timestamp: new Date().toISOString(),
        };
        return response;
      }

      const result = await this.ordersService.searchOrders(searchTerm, query);

      const responseTime = Date.now() - startTime;
      this.logger.log(`Orders search completed in ${responseTime}ms`);

      const response = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };

      return response;
    } catch (error) {
      this.logger.error('Error searching orders:', error);
      throw new HttpException(
        'Failed to search orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getOrderById(@Query('id') id: string) {
    try {
      const order = await this.ordersService.getOrderById(id);

      if (!order) {
        const response = {
          success: false,
          message: 'Order not found',
          timestamp: new Date().toISOString(),
        };
        return response;
      }

      const response = {
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
      };

      return response;
    } catch (error) {
      this.logger.error('Error getting order by id:', error);
      throw new HttpException(
        'Failed to get order by id',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Body() createOrderDto: CreateOrderDto | CreateOrderDto[]) {
    try {
      if (Array.isArray(createOrderDto)) {
        const orders =
          await this.ordersService.createBatchOrders(createOrderDto);
        const response = {
          success: true,
          data: orders,
          message: `${orders.length} orders created successfully`,
          timestamp: new Date().toISOString(),
        };

        return response;
      }

      const order = await this.ordersService.createOrder(createOrderDto);

      const response = {
        success: true,
        data: order,
        message: 'Order created successfully',
        timestamp: new Date().toISOString(),
      };

      return response;
    } catch (error) {
      this.logger.error('Error creating order:', error);
      throw new HttpException(
        'Failed to create order',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
