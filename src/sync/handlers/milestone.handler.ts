import { Injectable } from '@nestjs/common';
import type { Milestone } from '@prisma/client';
import type { SyncJobDto } from '../dto/sync.dto';
import type { ISyncHandler, PrismaTx } from '../interfaces/sync.interface';

type MilestonePayload = Omit<Partial<Milestone>, 'startDate' | 'endDate'> & {
  startDate?: string;
  endDate?: string | null;
};

@Injectable()
export class MilestoneHandler implements ISyncHandler {
  async handle(
    tx: PrismaTx,
    userId: string,
    syncJob: SyncJobDto,
  ): Promise<void> {
    const { targetId, action, payload, timestamp } = syncJob;
    const jobDate = new Date(timestamp);

    const current = await tx.milestone.findUnique({ where: { id: targetId } });

    if (action === 'CREATE' || action === 'UPDATE') {
      if (!current || jobDate > current.clientUpdatedAt) {
        const data = payload as MilestonePayload;
        await tx.milestone.upsert({
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
        await tx.milestone.delete({ where: { id: targetId } });
      }
    }
  }

  private mapPayload(data: MilestonePayload) {
    return {
      goalId: data.goalId!, // FK — milestone은 항상 goal에 속함
      title: data.title || '',
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,
      done: data.done ?? false,
    };
  }
}
