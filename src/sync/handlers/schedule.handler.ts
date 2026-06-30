import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Schedule } from '@prisma/client';
import type { SyncJobDto } from '../dto/sync.dto';
import type {
  ISyncHandler,
  PrismaTx,
  SyncSubtask,
} from '../interfaces/sync.interface';

type SchedulePayload = Omit<
  Partial<Schedule>,
  'subtasks' | 'startDate' | 'endDate' | 'clientUpdatedAt'
> & {
  startDate?: string;
  endDate?: string | null;
  category?: string;
  priority?: string;
  subtasks?: SyncSubtask[] | null;
  version?: number;
};

@Injectable()
export class ScheduleHandler implements ISyncHandler {
  private readonly logger = new Logger(ScheduleHandler.name);

  async handle(
    tx: PrismaTx,
    userId: string,
    syncJob: SyncJobDto,
  ): Promise<void> {
    const { targetId, action, payload } = syncJob;
    const data = payload as SchedulePayload;

    if (action === 'CREATE') {
      const exists = await tx.schedule.findUnique({ where: { id: targetId } });
      if (!exists) {
        await tx.schedule.create({
          data: {
            id: targetId,
            userId,
            ...this.mapPayload(data),
            version: 1, // 초기 버전 세팅
          },
        });
      }
    } else if (action === 'UPDATE') {
      const clientVersion = data.version || 1;

      // ✅ Atomic Update (OCC 방어)
      const result = await tx.schedule.updateMany({
        where: {
          id: targetId,
          userId,
          version: clientVersion,
        },
        data: {
          ...this.mapPayload(data),
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        this.logger.warn(
          `[Conflict] Schedule ${targetId} 버전문제가 발생해 업데이트되지 않음. 다음 Pull에서 동기화됨.`,
        );
      }
    } else if (action === 'DELETE') {
      // ✅ Tombstone (소프트 삭제)
      const result = await tx.schedule.updateMany({
        where: { id: targetId, userId },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        this.logger.warn(
          `[Delete Conflict] Schedule ${targetId} 이미 삭제되었거나 없음.`,
        );
      }
    }
  }

  private mapPayload(data: SchedulePayload) {
    return {
      groupId: data.groupId ?? undefined,
      creationMode: data.creationMode ?? undefined,
      type: data.type ?? undefined,
      goalId: data.goalId ?? undefined,
      milestoneId: data.milestoneId ?? undefined,
      categoryId: data.categoryId ?? data.category ?? undefined,
      priorityId: data.priorityId ?? data.priority ?? undefined,
      summary: data.summary || '',
      done: data.done ?? false,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate:
        data.endDate === undefined
          ? undefined
          : data.endDate
            ? new Date(data.endDate)
            : null,
      startTime: data.startTime ?? undefined,
      endTime: data.endTime ?? undefined,
      isPinned: data.isPinned ?? false,
      orderIndex: data.orderIndex ?? 0,
      isRecurring: data.isRecurring ?? false,
      repeatWeekdays: data.repeatWeekdays ?? [],
      subtasks:
        data.subtasks === undefined
          ? undefined
          : data.subtasks === null
            ? Prisma.DbNull
            : (data.subtasks as unknown as Prisma.InputJsonValue),
    };
  }
}
