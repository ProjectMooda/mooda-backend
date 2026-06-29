/** Bull 큐 이름 (BullModule.registerQueue, @Processor, @InjectQueue 모두 여기서 가져옴) */
export const SYNC_QUEUE_NAME = 'sync-queue' as const;

/** Bull 큐 내 작업 이름 (@Process, syncQueue.add의 첫 번째 인자) */
export const SYNC_JOB_NAME = 'process-user-sync' as const;

/**
 * 엔티티 처리 우선순위 — 숫자가 낮을수록 먼저 처리.
 * FK 의존성 순서: category/priority → goal → milestone → schedule
 */
export const ENTITY_PROCESSING_PRIORITY: Record<string, number> = {
  category: 1,
  priority: 1,
  goal: 2,
  milestone: 3,
  schedule: 4,
};

/** Bull 재시도 옵션 */
export const SYNC_JOB_OPTIONS = {
  attempts: 3, // 최대 재시도 횟수
  backoff: 5000, // 재시도 간격 (ms)
} as const;
