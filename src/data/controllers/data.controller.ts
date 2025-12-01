import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
} from '@nestjs/common';

import { DataService } from 'src/data/services/data.service';
import { CreateDataPointDto } from 'src/data/dtos/create-data-point.dto';
import { QueryDataDto } from 'src/data/dtos/query-data.dto';

@Controller('data')
export class DataController {
  private logger = new Logger(DataController.name);

  constructor(private dataService: DataService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestData(@Body() body: CreateDataPointDto | CreateDataPointDto[]) {
    const startTime = Date.now();
    const dataPoints = Array.isArray(body) ? body : [body];

    if (dataPoints.length === 0) {
      throw new BadRequestException('No data points provided');
    }

    if (dataPoints.length > 5000) {
      await this.dataService.ingestHighThroughputData(dataPoints);

      const response = {
        success: true,
        message: `${dataPoints.length} data points queued for high-throughput processing`,
        timestamp: new Date().toISOString(),
      };

      return response;
    }

    const result = await this.dataService.ingestData(dataPoints);

    const responseTime = Date.now() - startTime;
    this.logger.log(`Data ingestion completed in ${responseTime}ms`);

    const response = {
      success: true,
      data: result,
      message: `${dataPoints.length} data points ${
        result.queued ? 'queued' : 'processed'
      }`,
      timestamp: new Date().toISOString(),
    };

    return response;
  }

  @Get('stats')
  async getDataStats(@Query('realtime') realTime?: string) {
    const startTime = Date.now();
    const isRealTime = realTime === 'true';

    const stats = isRealTime
      ? await this.dataService.getRealtimeStats()
      : await this.dataService.getDataStats();

    const responseTime = Date.now() - startTime;
    this.logger.log(`Data stats fetched in ${responseTime}ms`);

    const response = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };

    return response;
  }

  @Get('history')
  async getDataHistory(@Query() query: QueryDataDto) {
    const result = await this.dataService.getDataHistory(query);

    const response = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    return response;
  }

  @Get('aggregate')
  async aggregateData(
    @Query('type') type: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('interval') interval: 'hour' | 'day' | 'week' = 'hour',
  ) {
    if (!type || !startDate || !endDate) {
      throw new BadRequestException('type, startDate and endDate are required');
    }

    const result = await this.dataService.aggregateData(
      type as string,
      new Date(startDate),
      new Date(endDate),
      interval as 'hour' | 'day' | 'week',
    );

    const response = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    return response;
  }
}
