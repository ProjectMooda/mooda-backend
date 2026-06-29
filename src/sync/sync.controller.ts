import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SyncRequestDto } from './dto/sync.dto';
import {
  SYNC_JOB_NAME,
  SYNC_QUEUE_NAME,
  SYNC_JOB_OPTIONS,
} from 'src/common/constants/sync.constants';
import type { JwtRequest } from '../common/types/jwt-request.type';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(
    @InjectQueue(SYNC_QUEUE_NAME) private readonly syncQueue: Queue,
  ) {}

  /**
   * 클라이언트의 오프라인 변경 사항을 수신합니다.
   * Job을 Redis 큐에 적재하고 즉시 응답 — 실제 DB 처리는 Processor가 백그라운드에서 수행.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async syncData(@Req() req: JwtRequest, @Body() dto: SyncRequestDto) {
    if (!dto.jobs?.length) {
      return { success: true, processed: 0 };
    }

    await this.syncQueue.add(
      SYNC_JOB_NAME,
      { userId: req.user.id, jobs: dto.jobs },
      SYNC_JOB_OPTIONS,
    );

    return { success: true, message: 'Sync jobs successfully queued' };
  }
}
