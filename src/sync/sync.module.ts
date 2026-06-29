import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from '../auth/auth.module';
import { SYNC_QUEUE_NAME } from 'src/common/constants/sync.constants';
import { SyncController } from './sync.controller';
import { SyncProcessor } from './sync.processor';
import { SyncService } from './sync.service';
import { ScheduleHandler } from './handlers/schedule.handler';
import { GoalHandler } from './handlers/goal.handler';
import { MilestoneHandler } from './handlers/milestone.handler';
import { CategoryHandler } from './handlers/category.handler';
import { PriorityHandler } from './handlers/priority.handler';

@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: SYNC_QUEUE_NAME })],
  controllers: [SyncController],
  providers: [
    SyncService,
    SyncProcessor,
    // 엔티티 핸들러 (SyncService가 DI로 주입받음)
    ScheduleHandler,
    GoalHandler,
    MilestoneHandler,
    CategoryHandler,
    PriorityHandler,
  ],
})
export class SyncModule {}
