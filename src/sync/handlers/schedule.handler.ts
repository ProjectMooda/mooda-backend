import { Injectable } from '@nestjs/common';
import { Prisma, Schedule } from '@prisma/client';
import type { SyncJobDto } from '../dto/sync.dto';
import type {
  ISyncHandler,
  PrismaTx,
  SyncSubtask,
} from '../interfaces/sync.interface';

/** 프론트엔드 페이로드 타입 — DB 타입(Date)과 달리 날짜가 string으로 올 수 있음 */
type SchedulePayload = Omit<
  Partial<Schedule>,
  'subtasks' | 'startDate' | 'endDate'
> & {
  startDate?: string;
  endDate?: string | null;
  category?: string; // 프론트 스토어의 categoryId 별칭
  priority?: string; // 프론트 스토어의 priorityId 별칭
  subtasks?: SyncSubtask[] | null;
};

@Injectable()
export class ScheduleHandler implements ISyncHandler {
  /**
   * 충돌 해결 전략: Last-Write-Wins (clientUpdatedAt 비교)
   * 클라이언트 타임스탬프가 DB보다 최신인 경우에만 덮어씀.
   */
  async handle(
    tx: PrismaTx,
    userId: string,
    syncJob: SyncJobDto,
  ): Promise<void> {
    const { targetId, action, payload, timestamp } = syncJob;
    const jobDate = new Date(timestamp);

    const current = await tx.schedule.findUnique({ where: { id: targetId } });

    if (action === 'CREATE' || action === 'UPDATE') {
      if (!current || jobDate > current.clientUpdatedAt) {
        const data = payload as SchedulePayload;
        await tx.schedule.upsert({
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
        await tx.schedule.delete({ where: { id: targetId } });
      }
    }
  }

  /** 프론트엔드 페이로드 → Prisma 입력 구조 변환 */
  private mapPayload(data: SchedulePayload) {
    return {
      groupId: data.groupId ?? undefined,
      creationMode: data.creationMode ?? undefined,
      type: data.type ?? undefined,
      goalId: data.goalId ?? undefined,
      milestoneId: data.milestoneId ?? undefined,
      // 프론트 스토어 변수명(category/priority) ↔ DB 필드명(categoryId/priorityId) 호환
      categoryId: data.categoryId ?? data.category ?? undefined,
      priorityId: data.priorityId ?? data.priority ?? undefined,
      summary: data.summary || '',
      done: data.done ?? false,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      // undefined → 필드 무시 / null → DB NULL / string → Date 변환
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
      // Prisma JSON 필드: undefined → 무시 / null → DbNull / 값 → InputJsonValue
      subtasks:
        data.subtasks === undefined
          ? undefined
          : data.subtasks === null
            ? Prisma.DbNull
            : (data.subtasks as unknown as Prisma.InputJsonValue),
    };
  }
}
