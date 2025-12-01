import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { OrderStatus } from 'src/orders/types/order.types';

export type OrderDocument = HydratedDocument<Order>;

@Schema({
  timestamps: true,
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Order {
  @Prop({ required: true, trim: true, maxlength: 255, type: String })
  customerName: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 255,
    index: true,
    type: String,
  })
  customerEmail: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 255,
    index: true,
    type: String,
  })
  productName: string;

  @Prop({ required: true, min: 1, type: Number })
  quantity: number;

  @Prop({ required: true, min: 0, type: Number })
  price: number;

  @Prop()
  totalAmount: number;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.PENDING,
    index: true,
  })
  status: OrderStatus;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ status: 1, createdAt: -1 }); // Get recent orders by status
OrderSchema.index({ customerEmail: 1, createdAt: -1 }); // Get recent orders by customer email
OrderSchema.index({ createdAt: -1 }); // Get recent orders
OrderSchema.index({ totalAmount: -1 }); // Get orders by total amount

OrderSchema.index(
  {
    customerName: 'text',
    customerEmail: 'text',
    productName: 'text',
  },
  {
    weights: {
      productName: 10,
      customerName: 5,
      customerEmail: 1,
    },
    name: 'order_text_search',
  },
);

OrderSchema.index({ status: 1, totalAmount: 1 }); // Get orders by status and total amount
OrderSchema.index({ createdAt: 1, status: 1 }); // Get orders by created date and status

OrderSchema.pre('save', function (next) {
  if (this.isModified('quantity') || this.isModified('price')) {
    this.totalAmount = this.quantity * this.price;
  }
  next();
});

OrderSchema.statics.getPerformanceStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        avgOrderValue: { $avg: '$totalAmount' },
        maxOrderValue: { $max: '$totalAmount' },
        minOrderValue: { $min: '$totalAmount' },
      },
    },
  ]);
};
