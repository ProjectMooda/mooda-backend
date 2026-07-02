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
};

@Injectable()
export class ScheduleHandler implements ISyncHandler {
  private readonly logger = new Logger(ScheduleHandler.name);

  async handle(
    tx: PrismaTx,
    userId: string,
    syncJob: SyncJobDto,
  ): Promise<{ entity: 'schedule'; id: string } | void> {
    const { targetId, action, payload } = syncJob;
    const data = payload as SchedulePayload;

    if (action === 'CREATE') {
      const exists = await tx.schedule.findUnique({ where: { id: targetId } });
      if (!exists) {
        await tx.schedule.create({
          data: { id: targetId, userId, ...this.mapPayload(data) },
        });
        return { entity: 'schedule', id: targetId };
      }
    } else if (action === 'UPDATE') {
      const result = await tx.schedule.updateMany({
        where: { id: targetId, userId },
        data: this.mapPayload(data),
      });
      if (result.count > 0) {
        return { entity: 'schedule', id: targetId };
      }
      this.logger.warn(
        `[Sync] Schedule ${targetId} 대상 없음 (삭제됨/미존재).`,
      );
    } else if (action === 'DELETE') {
      const result = await tx.schedule.updateMany({
        where: { id: targetId, userId },
        data: { deletedAt: new Date() },
      });
      if (result.count === 0) {
        this.logger.warn(
          `[Delete] Schedule ${targetId} 이미 삭제되었거나 없음.`,
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
