import { Module } from '@nestjs/common';
import { DataController } from './controllers/data.controller';
import { DataService } from './services/data.service';
import { DataRepository } from './repositories/data.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { DataPoint, DataPointSchema } from './schemas/data-point.schema';
import { CacheModule } from 'src/cache/cache.module';
import { JobsModule } from 'src/jobs/jobs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: DataPoint.name,
        schema: DataPointSchema,
      },
    ]),
    CacheModule,
    JobsModule,
  ],
  controllers: [DataController],
  providers: [DataService, DataRepository],
  exports: [DataService],
})
export class DataModule {}
