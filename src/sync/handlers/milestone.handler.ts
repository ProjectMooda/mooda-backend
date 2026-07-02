import { Injectable, Logger } from '@nestjs/common';
import type { SyncJobDto } from '../dto/sync.dto';
import type { ISyncHandler, PrismaTx } from '../interfaces/sync.interface';

type MilestonePayload = {
  goalId?: string;
  title?: string;
  startDate?: string;
  endDate?: string | null;
  done?: boolean;
};

@Injectable()
export class MilestoneHandler implements ISyncHandler {
  private readonly logger = new Logger(MilestoneHandler.name);

  async handle(
    tx: PrismaTx,
    userId: string,
    syncJob: SyncJobDto,
  ): Promise<void> {
    const { targetId, action, payload } = syncJob;
    const data = payload as MilestonePayload;

    if (action === 'CREATE') {
      const exists = await tx.milestone.findUnique({ where: { id: targetId } });

      if (!exists) {
        await tx.milestone.create({
          data: {
            id: targetId,
            userId,
            ...this.mapPayload(data),
          },
        });
      }
    } else if (action === 'UPDATE') {
      const result = await tx.milestone.updateMany({
        where: {
          id: targetId,
          userId,
        },
        data: this.mapPayload(data),
      });

      if (result.count === 0) {
        this.logger.warn(
          `[Update Failed] Milestone ${targetId}를 찾을 수 없습니다.`,
        );
      }
    } else if (action === 'DELETE') {
      const result = await tx.milestone.updateMany({
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
          `[Delete Failed] Milestone ${targetId}를 찾을 수 없습니다.`,
        );
      }
    }
  }

  private mapPayload(data: MilestonePayload) {
    return {
      goalId: data.goalId!,
      title: data.title || '',
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,
      done: data.done ?? false,
    };
  }
}
