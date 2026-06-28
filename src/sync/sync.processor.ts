import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { SyncJobDto } from './dto/sync.dto';
// 프리즈마가 만든 타입 이용
import {
  Prisma,
  Schedule,
  Goal,
  Milestone,
  Category,
  PriorityOption,
} from '@prisma/client';

interface SyncSubtask {
  id: number;
  text: string;
  done: boolean;
}

@Processor('sync-queue')
export class SyncProcessor {
  constructor(private readonly prisma: PrismaService) {}

  @Process('process-user-sync')
  async handleUserSync(job: Job<{ userId: string; jobs: SyncJobDto[] }>) {
    const { userId, jobs } = job.data;

    // 🌟 추가된 핵심 로직: 엔티티 간의 의존성(부모-자식) 순서 정의
    // 숫자가 작을수록 DB에 먼저 들어가야 하는 부모 테이블입니다.
    const entityPriority = {
      category: 1,
      priority: 1,
      goal: 2,
      milestone: 3,
      schedule: 4,
    };

    // 🌟 배열 정렬: 1순위(시간 오름차순), 2순위(부모 엔티티 먼저)
    jobs.sort((a, b) => {
      // 1. 먼저 생성된 과거의 작업부터 순차적으로 처리
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      // 2. 만약 시간이 동일하다면 부모 테이블(카테고리 등)부터 처리
      return entityPriority[a.entity] - entityPriority[b.entity];
    });

    // 데이터 일관성을 위해 전체 작업을 단일 트랜잭션으로 처리
    await this.prisma.$transaction(async (tx) => {
      for (const syncJob of jobs) {
        const { entity, action, targetId, payload, timestamp } = syncJob;
        const jobDate = new Date(timestamp);

        // ----------------------------------------------------
        // [1] SCHEDULE 처리 (subtasks JSON 바인딩 포함)
        // ----------------------------------------------------
        if (entity === 'schedule') {
          const current = await tx.schedule.findUnique({
            where: { id: targetId },
          });

          if (action === 'CREATE' || action === 'UPDATE') {
            if (!current || jobDate > current.clientUpdatedAt) {
              // 🌟 payload를 Prisma의 Schedule 타입(정확히는 모든 필드가 선택적인 Partial)으로 캐스팅합니다.
              // 이제 payload.groupId는 'any'가 아니라 'string | null'로 안전하게 추론됩니다!

              // 🌟 1. 프론트엔드에서 보낸 필드명(category)과 DB 필드명(categoryId)이 다를 수 있으므로 유연하게 캐스팅
              const scheduleData = payload as Omit<
                Partial<Schedule>,
                'subtasks'
              > & {
                category?: string;
                priority?: string;
                subtasks?: SyncSubtask[] | null;
              };

              const mappedData = {
                groupId: scheduleData.groupId ?? undefined,
                creationMode: scheduleData.creationMode ?? undefined,
                type: scheduleData.type ?? undefined,
                goalId: scheduleData.goalId ?? undefined,
                milestoneId: scheduleData.milestoneId ?? undefined,
                // 프론트엔드의 스토어 변수명 호환을 위해 fallback 추가
                categoryId:
                  scheduleData.categoryId ?? scheduleData.category ?? undefined,
                priorityId:
                  scheduleData.priorityId ?? scheduleData.priority ?? undefined,
                summary: scheduleData.summary || '',
                done: scheduleData.done ?? false,
                startDate: scheduleData.startDate
                  ? new Date(scheduleData.startDate)
                  : new Date(),
                // endDate가 아예 안 오면(undefined) 무시, null이 오면 null로 처리
                endDate:
                  scheduleData.endDate === undefined
                    ? undefined
                    : scheduleData.endDate
                      ? new Date(scheduleData.endDate)
                      : null,
                startTime: scheduleData.startTime ?? undefined,
                endTime: scheduleData.endTime ?? undefined,
                isPinned: scheduleData.isPinned ?? false,
                orderIndex: scheduleData.orderIndex ?? 0,
                isRecurring: scheduleData.isRecurring ?? false,
                repeatWeekdays: scheduleData.repeatWeekdays ?? [],

                // 🌟 2. Prisma JSON 에러 완벽 해결 (핵심)
                // undefined면 무시, null이면 DB용 Null(Prisma.DbNull) 적용, 그 외엔 Prisma JSON 타입으로 강제 단언
                subtasks:
                  scheduleData.subtasks === undefined
                    ? undefined
                    : scheduleData.subtasks === null
                      ? Prisma.DbNull
                      : (scheduleData.subtasks as unknown as Prisma.InputJsonValue),
              };

              await tx.schedule.upsert({
                where: { id: targetId },
                create: {
                  id: targetId,
                  userId,
                  ...mappedData,
                  clientUpdatedAt: jobDate,
                },
                update: { ...mappedData, clientUpdatedAt: jobDate },
              });
            }
          } else if (action === 'DELETE') {
            if (current && jobDate > current.clientUpdatedAt) {
              await tx.schedule.delete({ where: { id: targetId } });
            }
          }
        }

        // ----------------------------------------------------
        // [2] GOAL 처리
        // ----------------------------------------------------
        else if (entity === 'goal') {
          const current = await tx.goal.findUnique({ where: { id: targetId } });

          if (action === 'CREATE' || action === 'UPDATE') {
            if (!current || jobDate > current.clientUpdatedAt) {
              // 🌟 여기에도 Partial<Goal> 캐스팅 적용!
              const goalData = payload as Partial<Goal>;

              const mappedData = {
                title: goalData.title || '',
                startDate: goalData.startDate
                  ? new Date(goalData.startDate)
                  : new Date(),
                endDate: goalData.endDate ? new Date(goalData.endDate) : null,
                color: goalData.color || '#ef4444',
                isArchived: goalData.isArchived ?? false,
              };

              await tx.goal.upsert({
                where: { id: targetId },
                create: {
                  id: targetId,
                  userId,
                  ...mappedData,
                  clientUpdatedAt: jobDate,
                },
                update: { ...mappedData, clientUpdatedAt: jobDate },
              });
            }
          } else if (action === 'DELETE') {
            if (current && jobDate > current.clientUpdatedAt) {
              await tx.goal.delete({ where: { id: targetId } });
            }
          }
        }

        // ----------------------------------------------------
        // [3] MILESTONE 처리
        // ----------------------------------------------------
        else if (entity === 'milestone') {
          const current = await tx.milestone.findUnique({
            where: { id: targetId },
          });

          if (action === 'CREATE' || action === 'UPDATE') {
            if (!current || jobDate > current.clientUpdatedAt) {
              const milestoneData = payload as Partial<Milestone>;

              const mappedData = {
                goalId: milestoneData.goalId!,
                title: milestoneData.title || '',
                startDate: milestoneData?.startDate
                  ? new Date(milestoneData.startDate)
                  : new Date(),
                endDate: milestoneData?.endDate
                  ? new Date(milestoneData.endDate)
                  : null,
                done: milestoneData?.done ?? false,
              };

              await tx.milestone.upsert({
                where: { id: targetId },
                create: {
                  id: targetId,
                  userId,
                  ...mappedData,
                  clientUpdatedAt: jobDate,
                },
                update: { ...mappedData, clientUpdatedAt: jobDate },
              });
            }
          } else if (action === 'DELETE') {
            if (current && jobDate > current.clientUpdatedAt) {
              await tx.milestone.delete({ where: { id: targetId } });
            }
          }
        }

        // ----------------------------------------------------
        // [4] CATEGORY 처리
        // ----------------------------------------------------
        else if (entity === 'category') {
          const current = await tx.category.findUnique({
            where: { id: targetId },
          });

          if (action === 'CREATE' || action === 'UPDATE') {
            const categoryData = payload as Partial<Category>;
            if (!current || jobDate > current.clientUpdatedAt) {
              const mappedData = {
                label: categoryData?.label || '',
                emoji: categoryData?.emoji || '',
              };

              await tx.category.upsert({
                where: { id: targetId },
                create: {
                  id: targetId,
                  userId,
                  ...mappedData,
                  clientUpdatedAt: jobDate,
                },
                update: { ...mappedData, clientUpdatedAt: jobDate },
              });
            }
          } else if (action === 'DELETE') {
            if (current && jobDate > current.clientUpdatedAt) {
              await tx.category.delete({ where: { id: targetId } });
            }
          }
        }

        // ----------------------------------------------------
        // [5] PRIORITY OPTION 처리
        // ----------------------------------------------------
        else if (entity === 'priority') {
          const current = await tx.priorityOption.findUnique({
            where: { id: targetId },
          });

          if (action === 'CREATE' || action === 'UPDATE') {
            if (!current || jobDate > current.clientUpdatedAt) {
              const priorityData = payload as Partial<PriorityOption>;

              const mappedData = {
                label: priorityData?.label || '',
                emoji: priorityData?.emoji || '',
                color: priorityData?.color || '',
              };

              await tx.priorityOption.upsert({
                where: { id: targetId },
                create: {
                  id: targetId,
                  userId,
                  ...mappedData,
                  clientUpdatedAt: jobDate,
                },
                update: { ...mappedData, clientUpdatedAt: jobDate },
              });
            }
          } else if (action === 'DELETE') {
            if (current && jobDate > current.clientUpdatedAt) {
              await tx.priorityOption.delete({ where: { id: targetId } });
            }
          }
        }
      }
    });

    console.log(
      `[Queue Worker] User ID: ${userId} - ${jobs.length} 건 동기화 완료`,
    );
  }
}
