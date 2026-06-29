import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import {
  SYNC_JOB_NAME,
  SYNC_QUEUE_NAME,
} from 'src/common/constants/sync.constants';
import type { SyncQueuePayload } from './interfaces/sync.interface';
import { SyncService } from './sync.service';

/**
 * Bull Queue Consumer (백그라운드 워커)
 *
 * ─ @Processor(SYNC_QUEUE_NAME)
 *     Redis의 'sync-queue'를 구독합니다.
 *     HTTP 요청이 아닌 Redis 이벤트로 트리거되므로
 *     Controller 없이도 독립적으로 동작합니다.
 *
 * ─ @Process(SYNC_JOB_NAME)
 *     Bull이 해당 이름의 Job을 큐에서 꺼낼 때 자동 호출됩니다.
 *     실패 시 sync.constants의 attempts/backoff 설정으로 자동 재시도됩니다.
 */
@Processor(SYNC_QUEUE_NAME)
export class SyncProcessor {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(private readonly syncService: SyncService) {}

  @Process(SYNC_JOB_NAME)
  async handleUserSync(job: Job<SyncQueuePayload>): Promise<void> {
    this.logger.debug(`Job #${job.id} 처리 시작 (userId: ${job.data.userId})`);
    await this.syncService.processJobs(job.data);
  }
}
