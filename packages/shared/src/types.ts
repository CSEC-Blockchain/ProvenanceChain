export enum BatchStatus {
  Active = 0,
  Recalled = 1,
  SoldOut = 2,
}

export interface Batch {
  id: bigint;
  producer: `0x${string}`;
  currentHolder: `0x${string}`;
  pendingHolder: `0x${string}`;
  productName: string;
  origin: string;
  metadataHash: `0x${string}`;
  unitCount: number;
  createdAt: bigint;
  status: BatchStatus;
}

export interface CustodyEvent {
  from: `0x${string}`;
  to: `0x${string}`;
  timestamp: bigint;
  location: string;
}

export type UserRole = 'ADMIN' | 'PRODUCER' | 'DISTRIBUTOR' | 'SHOP' | 'NONE';

export interface VerifiedBatchResult {
  batchId: number;
  batch: Batch;
  history: CustodyEvent[];
  producerName: string;
  currentHolderName: string;
  pendingHolderName?: string;
  verdict: 'AUTHENTIC' | 'CAUTION' | 'RECALLED' | 'NOT_FOUND';
  verdictReason: string;
  isCustodyChainComplete: boolean;
}
