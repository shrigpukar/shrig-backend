import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from 'src/common/filters/http-exception.filter';
import { LogInterceptor } from 'src/common/interceptors/log-interceptor.interceptor';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LogInterceptor(), new TransformInterceptor());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
