import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ENTITY_PROCESSING_PRIORITY } from 'src/common/constants/sync.constants';
import type { SyncJobDto, SyncEntity } from './dto/sync.dto';
import type {
  ISyncHandler,
  SyncQueuePayload,
} from './interfaces/sync.interface';
import { ScheduleHandler } from './handlers/schedule.handler';
import { GoalHandler } from './handlers/goal.handler';
import { MilestoneHandler } from './handlers/milestone.handler';
import { CategoryHandler } from './handlers/category.handler';
import { PriorityHandler } from './handlers/priority.handler';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleHandler: ScheduleHandler,
    private readonly goalHandler: GoalHandler,
    private readonly milestoneHandler: MilestoneHandler,
    private readonly categoryHandler: CategoryHandler,
    private readonly priorityHandler: PriorityHandler,
  ) {}

  async processJobs({ userId, jobs }: SyncQueuePayload): Promise<void> {
    const sorted = this.sortByDependencyOrder(jobs);

    await this.prisma.$transaction(async (tx) => {
      for (const job of sorted) {
        await this.getHandler(job.entity).handle(tx, userId, job);
      }
    });

    this.logger.log(`userId: ${userId} — ${jobs.length}건 동기화 완료`);
  }

  private sortByDependencyOrder(jobs: SyncJobDto[]): SyncJobDto[] {
    return [...jobs].sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return (
        (ENTITY_PROCESSING_PRIORITY[a.entity] ?? 99) -
        (ENTITY_PROCESSING_PRIORITY[b.entity] ?? 99)
      );
    });
  }

  private getHandler(entity: SyncEntity): ISyncHandler {
    const handlers: Record<SyncEntity, ISyncHandler> = {
      schedule: this.scheduleHandler,
      goal: this.goalHandler,
      milestone: this.milestoneHandler,
      category: this.categoryHandler,
      priority: this.priorityHandler,
    };
    return handlers[entity];
  }

  // ✅ 구조화된 Pull API (5개 엔티티 전체 긁어오기)
  async pullIncrementalSync(userId: string, since: number) {
    const sinceDate = new Date(since || 0);
    const cursorDate = new Date();

    const [schedule, goal, milestone, category, priority] = await Promise.all([
      this.prisma.schedule.findMany({
        where: {
          userId,
          updatedAt: {
            gt: sinceDate,
            lte: cursorDate,
          },
        },
        orderBy: {
          updatedAt: 'asc',
        },
      }),
      this.prisma.goal.findMany({
        where: {
          userId,
          updatedAt: {
            gt: sinceDate,
            lte: cursorDate,
          },
        },
        orderBy: {
          updatedAt: 'asc',
        },
      }),
      this.prisma.milestone.findMany({
        where: {
          userId,
          updatedAt: {
            gt: sinceDate,
            lte: cursorDate,
          },
        },
        orderBy: {
          updatedAt: 'asc',
        },
      }),
      this.prisma.category.findMany({
        where: {
          userId,
          updatedAt: {
            gt: sinceDate,
            lte: cursorDate,
          },
        },
        orderBy: {
          updatedAt: 'asc',
        },
      }),
      this.prisma.priorityOption.findMany({
        where: {
          userId,
          updatedAt: {
            gt: sinceDate,
            lte: cursorDate,
          },
        },
        orderBy: {
          updatedAt: 'asc',
        },
      }),
    ]);

    return {
      schedule,
      goal,
      milestone,
      category,
      priority,
      serverTimestamp: cursorDate.getTime(),
    };
  }
}
