export interface DataPoint {
  id: string;
  type: string;
  value: number;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface DataStats {
  totalPoints: number;
  avgValue: number;
  minValue: number;
  maxValue: number;
  dataByType: Record<string, number>;
}

export interface ProcessDataJob {
  data: DataPoint[];
  batchId: string;
  priority: number;
}
