export interface DataPoint {
  type: string;
  value: number;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface ProcessDataJob {
  data: DataPoint[];
  batchId: string;
  priority: number;
}
