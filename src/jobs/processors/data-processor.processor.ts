import {
  InjectQueue,
  OnQueueCompleted,
  OnQueueFailed,
  OnQueueStalled,
  Process,
  Processor,
} from '@nestjs/bull';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Job, Queue } from 'bull';
import { Model } from 'mongoose';
import { CacheService } from 'src/cache/services/cache.service';
import {
  DataPoint,
  DataPointDocument,
} from 'src/data/schemas/data-point.schema';
import { ProcessDataJob } from '../types/job.types';

@Injectable()
@Processor('data-processing')
export class DataProcessorService {
  private readonly logger = new Logger(DataProcessorService.name);

  constructor(
    @InjectQueue('data-processing') private dataQueue: Queue,
    @InjectModel(DataPoint.name)
    private dataPointModel: Model<DataPointDocument>,
    private readonly cacheService: CacheService,
  ) {}
  @Process('process_data')
  async processDataJob(job: Job<ProcessDataJob>) {
    const { data, batchId } = job.data;

    this.logger.log(
      `Processing data batch ${batchId} with ${data.length} points`,
    );

    await job.progress(10);

    const docs = data.map((point) => ({
      ...point,
      timestamp: point.timestamp || new Date(),
    }));
    const savedData = await this.dataPointModel.insertMany(docs);
    await job.progress(50);

    const timeAgo = new Date(Date.now() - 5 * 60 * 1000);
    const statsResult = await this.dataPointModel.aggregate([
      { $match: { timestamp: { $gte: timeAgo } } },
      {
        $group: {
          _id: null,
          totalPoints: { $sum: 1 },
          avgValue: { $avg: '$value' },
          minValue: { $min: '$value' },
          maxValue: { $max: '$value' },
        },
      },
    ]);

    const stats = statsResult[0] || {
      totalPoints: 0,
      avgValue: 0,
      minValue: 0,
      maxValue: 0,
    };
    await job.progress(70);

    await this.cacheService.set('realtime_stats', stats, 60);
    await job.progress(80);

    this.logger.log(`Successfully processed data batch ${batchId}`);

    await job.progress(100);

    return {
      batchId,
      processedCount: savedData.length,
      stats,
    };
  }

  async addDataProcessingJob(data: any[], priority: number = 0) {
    const batchId = `batch_${Date.now}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      await this.dataQueue.add(
        'process_data',
        {
          data,
          batchId,
          priority,
        },
        {
          priority,
          delay: 0,
        },
      );

      this.logger.log(`Added data processing job for batch ${batchId}`);
    } catch (error) {
      this.logger.error('Error adding data processing job:', error);
      throw new HttpException(
        'Failed to add data processing job',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Job ${job.id} completed with result:`, result);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed`, error);
  }

  @OnQueueStalled()
  onStalled(job: Job) {
    this.logger.warn(`Job ${job.id} stalled`);
  }
}
