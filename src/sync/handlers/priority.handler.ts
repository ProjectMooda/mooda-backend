import { Injectable } from '@nestjs/common';
import type { PriorityOption } from '@prisma/client'; // ✅ Prisma 타입 임포트
import type { SyncJobDto } from '../dto/sync.dto';
import type { ISyncHandler, PrismaTx } from '../interfaces/sync.interface';

@Injectable()
export class PriorityHandler implements ISyncHandler {
  async handle(
    tx: PrismaTx,
    userId: string,
    syncJob: SyncJobDto,
  ): Promise<void> {
    const { targetId, action, payload } = syncJob;

    // ✅ Prisma 타입 활용
    const data = (payload || {}) as Partial<PriorityOption>;

    if (action === 'CREATE') {
      const exists = await tx.priorityOption.findUnique({
        where: { id: targetId },
      });
      if (!exists) {
        await tx.priorityOption.create({
          data: {
            id: targetId,
            userId,
            label: data.label || '',
            emoji: data.emoji || '',
            color: data.color || '',
          },
        });
      }
    } else if (action === 'UPDATE') {
      await tx.priorityOption.updateMany({
        where: { id: targetId, userId },
        data: { label: data.label, emoji: data.emoji, color: data.color },
      });
    } else if (action === 'DELETE') {
      await tx.priorityOption.updateMany({
        where: { id: targetId, userId },
        data: { deletedAt: new Date() },
      });
    }
  }
}
