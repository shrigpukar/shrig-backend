import { Module } from '@nestjs/common';
import { CacheService } from 'src/cache/services/cache.service';

@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
