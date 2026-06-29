import type { Prisma } from '@prisma/client';
import type { SyncJobDto } from '../dto/sync.dto';

export interface SyncSubtask {
  id: number;
  text: string;
  done: boolean;
}

export interface SyncQueuePayload {
  userId: string;
  jobs: SyncJobDto[];
}

export type PrismaTx = Prisma.TransactionClient;

export interface ISyncHandler {
  handle(tx: PrismaTx, userId: string, job: SyncJobDto): Promise<void>;
}
