import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDataPointDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  type: string;

  @IsNumber()
  value: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  timestamp?: Date;
}
