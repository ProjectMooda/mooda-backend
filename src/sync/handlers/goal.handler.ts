import { Injectable, Logger } from '@nestjs/common';
import type { SyncJobDto } from '../dto/sync.dto';
import type { ISyncHandler, PrismaTx } from '../interfaces/sync.interface';

type GoalPayload = {
  title?: string;
  startDate?: string;
  endDate?: string | null;
  color?: string;
  isArchived?: boolean;
  version?: number;
};

@Injectable()
export class GoalHandler implements ISyncHandler {
  private readonly logger = new Logger(GoalHandler.name);

  async handle(
    tx: PrismaTx,
    userId: string,
    syncJob: SyncJobDto,
  ): Promise<void> {
    const { targetId, action, payload } = syncJob;
    const data = payload as GoalPayload;

    if (action === 'CREATE') {
      const exists = await tx.goal.findUnique({ where: { id: targetId } });
      if (!exists) {
        await tx.goal.create({
          data: {
            id: targetId,
            userId,
            ...this.mapPayload(data),
            version: 1,
          },
        });
      }
    } else if (action === 'UPDATE') {
      const clientVersion = data.version || 1;
      const result = await tx.goal.updateMany({
        where: { id: targetId, userId, version: clientVersion },
        data: { ...this.mapPayload(data), version: { increment: 1 } },
      });
      if (result.count === 0)
        this.logger.warn(
          `[Conflict] Goal ${targetId} 버전문제가 발생해 무시됨.`,
        );
    } else if (action === 'DELETE') {
      const result = await tx.goal.updateMany({
        where: { id: targetId, userId },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      if (result.count === 0)
        this.logger.warn(
          `[Delete Conflict] Goal ${targetId} 이미 삭제되었거나 없음.`,
        );
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
