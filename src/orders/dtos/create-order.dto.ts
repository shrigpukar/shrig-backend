import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { OrderStatus } from 'src/orders/types/order.types';

export class CreateOrderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  customerName: string;

  @IsEmail()
  @MaxLength(255)
  customerEmail: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  productName: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;
}
