// src/sync/sync.controller.ts
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// Request 타입을 확장하거나 임시 인터페이스 정의 (req.user 타입 에러 방어)
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @UseGuards(JwtAuthGuard) // 🔒 이제 이 API는 로그인 안 하면 절대 못 들어옴!
  async syncData(
    @Req() req: AuthenticatedRequest, // 💡 토큰 검증이 완료된 유저 정보가 여기 들어있음
    @Body() payload: any,
  ) {
    console.log(
      '🔥 멈춰! 가드 통과 후 컨트롤러 실행됨! 유저 ID:',
      req.user?.id,
    );
    // 💡 기존에 프론트가 던져주던 가짜 userId 대신, 토큰에서 인증된 진짜 유저 ID 주입!
    const userId = req.user.id;

    return this.syncService.processSync(userId, payload);
  }
}
