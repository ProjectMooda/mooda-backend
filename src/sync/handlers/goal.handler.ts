import { Injectable, Logger } from '@nestjs/common';
import type { SyncJobDto } from '../dto/sync.dto';
import type { ISyncHandler, PrismaTx } from '../interfaces/sync.interface';

type GoalPayload = {
  title?: string;
  startDate?: string;
  endDate?: string | null;
  color?: string;
  isArchived?: boolean;
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
          },
        });
      }
    } else if (action === 'UPDATE') {
      const result = await tx.goal.updateMany({
        where: {
          id: targetId,
          userId,
        },
        data: this.mapPayload(data),
      });

      if (result.count === 0) {
        this.logger.warn(
          `[Update Failed] Goal ${targetId}를 찾을 수 없습니다.`,
        );
      }
    } else if (action === 'DELETE') {
      const result = await tx.goal.updateMany({
        where: {
          id: targetId,
          userId,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      if (result.count === 0) {
        this.logger.warn(
          `[Delete Failed] Goal ${targetId}를 찾을 수 없습니다.`,
        );
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
