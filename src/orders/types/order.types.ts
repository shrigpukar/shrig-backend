export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  productName: string;
  quantity: number;
  price: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  ordersByStatus: Record<OrderStatus, number>;
  dailyOrders: Array<{
    date: string;
    count: number;
    revenue: number;
  }>;
}
