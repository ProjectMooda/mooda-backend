import { Injectable } from '@nestjs/common';
import type { PriorityOption } from '@prisma/client';
import type { SyncJobDto } from '../dto/sync.dto';
import type { ISyncHandler, PrismaTx } from '../interfaces/sync.interface';

@Injectable()
export class PriorityHandler implements ISyncHandler {
  async handle(
    tx: PrismaTx,
    userId: string,
    syncJob: SyncJobDto,
  ): Promise<void> {
    const { targetId, action, payload, timestamp } = syncJob;
    const jobDate = new Date(timestamp);

    const current = await tx.priorityOption.findUnique({
      where: { id: targetId },
    });

    if (action === 'CREATE' || action === 'UPDATE') {
      if (!current || jobDate > current.clientUpdatedAt) {
        const data = payload as Partial<PriorityOption>;
        const mapped = {
          label: data.label || '',
          emoji: data.emoji || '',
          color: data.color || '',
        };
        await tx.priorityOption.upsert({
          where: { id: targetId },
          create: { id: targetId, userId, ...mapped, clientUpdatedAt: jobDate },
          update: { ...mapped, clientUpdatedAt: jobDate },
        });
      }
    } else if (action === 'DELETE') {
      if (current && jobDate > current.clientUpdatedAt) {
        await tx.priorityOption.delete({ where: { id: targetId } });
      }
    }
  }
}
