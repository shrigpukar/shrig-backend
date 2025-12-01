import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(CacheService.name);
  private redis: RedisClientType;
  private defaultTTL: 300;
  private keyPrefix: 'shrig:';
  private memoryCache = new Map<string, { data: any; expiry: number }>();

  constructor() {
    this.redis = createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${
        process.env.REDIS_PORT || '6379'
      }`,
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB || '0'),
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            this.logger.error('Redis retry attempts exhausted');
            return new Error('Redis retry attempts exhausted');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.setupEventHandlers();
  }

  async onModuleInit() {
    await this.redis.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.log('Redis connected');
  }

  private setupEventHandlers() {
    this.redis.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis client error:', err);
    });

    this.redis.on('end', () => {
      this.logger.log('Redis client disconnected');
    });
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const cachedData = await this.redis.get(this.getKey(key));
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    return null;
  }

  async set(
    key: string,
    value: any,
    ttl: number = this.defaultTTL,
  ): Promise<boolean> {
    const serializedValue = JSON.stringify(value);
    await this.redis.setEx(this.getKey(key), ttl, serializedValue);
    return true;
  }

  async del(key: string): Promise<boolean> {
    await this.redis.del(this.getKey(key));
    return true;
  }

  async invalidatePattern(pattern: string): Promise<boolean> {
    const keys = await this.redis.keys(`${this.keyPrefix}${pattern}`);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
    return true;
  }

  // Multi-level caching: Memory + Redis
  // The reason behind using this strategy is memory is faster than redis and redis is faster than database.
  async getMultiLevel<T>(key: string): Promise<T | null> {
    const memoryData = this.memoryCache.get(key);

    if (memoryData && memoryData.expiry > Date.now()) {
      return memoryData.data;
    }

    const redisData = await this.get<T>(key);
    if (redisData) {
      this.memoryCache.set(key, {
        data: redisData,
        expiry: Date.now() + 60000, // 1 minute in memory
      });
      return redisData;
    }
    return null;
  }

  async setMultiLevel(
    key: string,
    value: any,
    ttl: number = this.defaultTTL,
  ): Promise<boolean> {
    this.memoryCache.set(key, {
      data: value,
      expiry: Date.now() + 60000, // 1 minute in memory
    });
    return await this.set(key, value, ttl);
  }
}
