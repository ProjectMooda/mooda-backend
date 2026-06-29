import { Injectable } from '@nestjs/common';
import type { Goal } from '@prisma/client';
import type { SyncJobDto } from '../dto/sync.dto';
import type { ISyncHandler, PrismaTx } from '../interfaces/sync.interface';

type GoalPayload = Omit<Partial<Goal>, 'startDate' | 'endDate'> & {
  startDate?: string;
  endDate?: string | null;
};

@Injectable()
export class GoalHandler implements ISyncHandler {
  async handle(
    tx: PrismaTx,
    userId: string,
    syncJob: SyncJobDto,
  ): Promise<void> {
    const { targetId, action, payload, timestamp } = syncJob;
    const jobDate = new Date(timestamp);

    const current = await tx.goal.findUnique({ where: { id: targetId } });

    if (action === 'CREATE' || action === 'UPDATE') {
      if (!current || jobDate > current.clientUpdatedAt) {
        const data = payload as GoalPayload;
        await tx.goal.upsert({
          where: { id: targetId },
          create: {
            id: targetId,
            userId,
            ...this.mapPayload(data),
            clientUpdatedAt: jobDate,
          },
          update: { ...this.mapPayload(data), clientUpdatedAt: jobDate },
        });
      }
    } else if (action === 'DELETE') {
      if (current && jobDate > current.clientUpdatedAt) {
        await tx.goal.delete({ where: { id: targetId } });
      }
    }
  }

  private mapPayload(data: GoalPayload) {
    return {
      title: data.title || '',
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,
      color: data.color || '#ef4444',
      isArchived: data.isArchived ?? false,
    };
  }
}
