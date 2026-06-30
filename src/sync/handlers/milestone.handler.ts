import { Injectable, Logger } from '@nestjs/common';
import type { SyncJobDto } from '../dto/sync.dto';
import type { ISyncHandler, PrismaTx } from '../interfaces/sync.interface';

type MilestonePayload = {
  goalId?: string;
  title?: string;
  startDate?: string;
  endDate?: string | null;
  done?: boolean;
  version?: number;
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
            version: 1,
          },
        });
      }
    } else if (action === 'UPDATE') {
      const clientVersion = data.version || 1;
      const result = await tx.milestone.updateMany({
        where: { id: targetId, userId, version: clientVersion },
        data: { ...this.mapPayload(data), version: { increment: 1 } },
      });
      if (result.count === 0)
        this.logger.warn(
          `[Conflict] Milestone ${targetId} 버전문제가 발생해 무시됨.`,
        );
    } else if (action === 'DELETE') {
      const result = await tx.milestone.updateMany({
        where: { id: targetId, userId },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      if (result.count === 0)
        this.logger.warn(
          `[Delete Conflict] Milestone ${targetId} 이미 삭제됨.`,
        );
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
