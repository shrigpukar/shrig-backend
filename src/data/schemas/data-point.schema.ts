import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DataPointDocument = HydratedDocument<DataPoint>;

@Schema({
  timestamps: false,
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class DataPoint {
  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true,
  })
  type: string;

  @Prop({
    type: Number,
    required: true,
    trim: true,
    maxlength: 100,
    index: true,
  })
  value: Number;

  @Prop({
    type: Object,
    default: {},
  })
  metadata: Record<string, any>;

  @Prop({
    type: Date,
    index: true,
    required: true,
    default: new Date(),
  })
  timestamp: Date;
}

export const DataPointSchema = SchemaFactory.createForClass(DataPoint);

DataPointSchema.index({ type: 1, timestamp: -1 });

DataPointSchema.index({ type: 1, value: 1 });
DataPointSchema.index({ 'metadata.sensor_id': 1, timestamp: -1 });
