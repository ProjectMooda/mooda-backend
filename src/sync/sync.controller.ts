// src/sync/sync.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncPayloadDto } from './dto/sync-payload.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  async synchronizeData(
    @Body('userId') userId: string, // 임시: 테스트용으로 body에서 userId를 받음 (나중에 JWT로 교체)
    @Body() payload: SyncPayloadDto,
  ) {
    if (!userId) {
      return { success: false, message: 'userId가 필요합니다.' };
    }
    return this.syncService.processSync(userId, payload);
  }
}
