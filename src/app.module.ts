import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrdersModule } from './orders/orders.module';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [OrdersModule, MongooseModule.forRoot('mongodb://localhost/nest'), CacheModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
