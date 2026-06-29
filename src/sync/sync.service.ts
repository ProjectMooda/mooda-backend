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

  /**
   * 동기화 Job 목록을 처리합니다.
   * 1. FK 의존성 순서에 따라 정렬 (category → goal → milestone → schedule)
   * 2. 단일 Prisma 트랜잭션으로 전체 처리 → 데이터 일관성 보장
   * 3. 엔티티 타입에 맞는 핸들러에 위임
   */
  async processJobs({ userId, jobs }: SyncQueuePayload): Promise<void> {
    const sorted = this.sortByDependencyOrder(jobs);

    await this.prisma.$transaction(async (tx) => {
      for (const job of sorted) {
        await this.getHandler(job.entity).handle(tx, userId, job);
      }
    });

    this.logger.log(`userId: ${userId} — ${jobs.length}건 동기화 완료`);
  }

  /**
   * Job 목록을 처리 순서에 맞게 정렬합니다.
   *  1순위: 타임스탬프 오름차순 (과거 액션 먼저)
   *  2순위: FK 의존성 순서 (부모 엔티티 먼저)
   */
  private sortByDependencyOrder(jobs: SyncJobDto[]): SyncJobDto[] {
    return [...jobs].sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return (
        (ENTITY_PROCESSING_PRIORITY[a.entity] ?? 99) -
        (ENTITY_PROCESSING_PRIORITY[b.entity] ?? 99)
      );
    });
  }

  /**
   * 엔티티 타입에 따라 적절한 핸들러를 반환합니다.
   * Record<SyncEntity, ...> 형태라 새 엔티티 추가 시 TypeScript가 누락을 알려줍니다.
   */
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
}
