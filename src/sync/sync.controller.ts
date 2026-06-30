import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SyncRequestDto } from './dto/sync.dto';
import type { JwtRequest } from '../common/types/jwt-request.type';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async syncData(@Req() req: JwtRequest, @Body() dto: SyncRequestDto) {
    if (!dto.jobs?.length) {
      return { success: true, processed: 0 };
    }

    // 큐 전송 내용을 Service로 넘김
    await this.syncService.processJobs({ userId: req.user.id, jobs: dto.jobs });
    return { success: true };
  }

  // 🌟 [추가됨] 404 에러의 원인이었던 Pull API 엔드포인트!
  @Get('pull')
  async pullIncrementalSync(
    @Req() req: JwtRequest,
    @Query('since') since: string,
  ) {
    console.log('🔥 pull 호출', since);
    const timestamp = parseInt(since, 10) || 0;
    return this.syncService.pullIncrementalSync(req.user.id, timestamp);
  }
}
