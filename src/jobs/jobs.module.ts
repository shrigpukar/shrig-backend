import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';

import { CacheModule } from 'src/cache/cache.module';
import { DataPoint, DataPointSchema } from 'src/data/schemas/data-point.schema';
import { DataProcessorService } from 'src/jobs/processors/data-processor.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'data-processing',
    }),
    MongooseModule.forFeature([
      { name: DataPoint.name, schema: DataPointSchema },
    ]),
    CacheModule,
  ],
  providers: [DataProcessorService],
  exports: [DataProcessorService],
})
export class JobsModule {}
