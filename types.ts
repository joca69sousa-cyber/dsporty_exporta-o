export interface ProductData {
  sheets: number;
  value: number;
  color: string;
}

// Generic interface compatible with both Firebase Timestamp and our mock objects
export interface FirestoreTimestamp {
    toDate: () => Date;
    toMillis: () => number;
}

export interface ProductionRecord {
  id: string;
  exporter: string;
  product: string;
  quantity: number;
  materialId: string;
  imageDataUrl?: string | null;
  timestamp: FirestoreTimestamp;
  verified: boolean;
}

export interface BatchItem {
  product: string;
  quantity: number;
  materialId: string;
  tempId: number;
}

export interface UserStats {
  total: number;
  items: number;
  toPay: number;
  details: ProductionRecord[];
}

export interface GlobalStats {
  total: number;
  count: number;
  verifiedTotal: number;
  byUser: Record<string, UserStats>;
  byProduct: Record<string, { count: number; total: number }>;
}

export type TimeRange = 'today' | 'week' | 'month' | 'year';

export type AdminTab = 'overview' | 'payments' | 'gallery' | 'detailed';