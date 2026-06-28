import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SyncRequestDto } from './dto/sync.dto';
import { Request } from 'express';

// 이거 jwt requset 머할지 전역 파일 하나 필요할 듯
interface JwtRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(@InjectQueue('sync-queue') private readonly syncQueue: Queue) {}

  @Post()
  async syncData(@Req() req: JwtRequest, @Body() dto: SyncRequestDto) {
    const userId = req.user.id;

    if (!dto.jobs || dto.jobs.length === 0) {
      return { success: true, processed: 0 };
    }

    // Redis 백그라운드 큐에 유저 ID와 작업 목록 적재
    await this.syncQueue.add(
      'process-user-sync',
      {
        userId,
        jobs: dto.jobs,
      },
      {
        attempts: 3, // 실패 시 최대 3번 재시도
        backoff: 5000, // 실패 시 5초 대기 후 재시도
      },
    );

    return { success: true, message: 'Sync jobs successfully queued' };
  }
}
