import { Model } from 'mongoose';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import {
  DataPoint,
  DataPointDocument,
} from 'src/data/schemas/data-point.schema';
import { CreateDataPointDto } from 'src/data/dtos/create-data-point.dto';
import { QueryDataDto } from 'src/data/dtos/query-data.dto';
import {
  DataPoint as DataPointType,
  DataStats,
} from 'src/data/types/data.types';
import {
  pagination,
  PaginationOptions,
} from 'src/common/utils/pagination.util';

export class DataRepository {
  private readonly logger = new Logger(DataRepository.name);

  constructor(
    @InjectModel(DataPoint.name)
    private dataPointModel: Model<DataPointDocument>,
  ) {}

  async create(dataPoints: CreateDataPointDto[]) {
    if (dataPoints.length === 0) return [];

    const docs = dataPoints.map((point) => ({
      ...point,
      timestamp: point.timestamp || new Date(),
    }));
    const savedDataPoints = await this.dataPointModel.insertMany(docs);

    return savedDataPoints.map(this.transformDataPoint);
  }

  async findAll(query: QueryDataDto) {
    const { type, startDate, endDate } = query;

    // Build filter
    const filter: any = {};

    if (type) {
      filter.type = type;
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = startDate;
      if (endDate) filter.timestamp.$lte = endDate;
    }

    return await pagination(
      this.dataPointModel,
      filter,
      query as PaginationOptions,
      this.transformDataPoint,
      {
        timestamp: -1,
      },
    );
  }

  async getStats(): Promise<DataStats> {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalPoints: { $sum: 1 },
          avgValue: { $avg: '$value' },
          minValue: { $min: '$value' },
          maxValue: { $max: '$value' },
        },
      },
    ];

    const typeStatsPipeline = [
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ];

    const [statsResult, typeStatsResult] = await Promise.all([
      this.dataPointModel.aggregate(pipeline),
      this.dataPointModel.aggregate(typeStatsPipeline),
    ]);

    const stats = statsResult[0] || {
      totalPoints: 0,
      avgValue: 0,
      minValue: 0,
      maxValue: 0,
    };

    const dataByType: Record<string, number> = {};
    typeStatsResult.forEach((row) => {
      dataByType[row._id] = row.count;
    });

    return {
      totalPoints: stats.totalPoints,
      avgValue: stats.avgValue || 0,
      minValue: stats.minValue || 0,
      maxValue: stats.maxValue || 0,
      dataByType: dataByType,
    };
  }

  async getRealtimeStats(minutes: number = 5): Promise<DataStats> {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: cutoffTime },
        },
      },
      {
        $group: {
          _id: null,
          totalPoints: { $sum: 1 },
          avgValue: { $avg: '$value' },
          minValue: { $min: '$value' },
          maxValue: { $max: '$value' },
        },
      },
    ];

    const typeStatsPipeline = [
      {
        $match: {
          timestamp: { $gte: cutoffTime },
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ];

    const [statsResult, typeStatsResult] = await Promise.all([
      this.dataPointModel.aggregate(pipeline),
      this.dataPointModel.aggregate(typeStatsPipeline),
    ]);

    const stats = statsResult[0] || {
      totalPoints: 0,
      avgValue: 0,
      minValue: 0,
      maxValue: 0,
    };

    const dataByType: Record<string, number> = {};
    typeStatsResult.forEach((row) => {
      dataByType[row._id] = row.count;
    });

    return {
      totalPoints: stats.totalPoints,
      avgValue: stats.avgValue || 0,
      minValue: stats.minValue || 0,
      maxValue: stats.maxValue || 0,
      dataByType: dataByType,
    };
  }

  async aggregateData(
    type: string,
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' | 'week',
  ) {
    const intervalMap = {
      hour: {
        $dateToString: { format: '%Y-%m-%d %H:00:00', date: '$timestamp' },
      },
      day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
      week: { $dateToString: { format: '%Y-W%V', date: '$timestamp' } },
    };

    const result = await this.dataPointModel.aggregate([
      {
        $match: {
          type: type,
          timestamp: { $gte: { startDate, $lte: endDate } },
        },
      },
      {
        $group: {
          _id: intervalMap[interval],
          count: { $sum: 1 },
          avgValue: { $avg: '$value' },
          sumValue: { $sum: '$value' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    return result.map((row: any) => ({
      timestamp: new Date(row.id),
      count: row.count,
      avgValue: row.avgValue,
      sumValue: row.sumValue,
    }));
  }

  private transformDataPoint(dataPoint: any): DataPointType {
    return {
      id: dataPoint._id?.toString() || dataPoint.id,
      type: dataPoint.type,
      value: dataPoint.value,
      metadata: dataPoint.metadata,
      timestamp: dataPoint.timestamp,
    };
  }
}
