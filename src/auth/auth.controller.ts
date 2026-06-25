import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SocialLoginDto } from './dto/social-login.dto';
import { AuthProvider } from './enums/provider.enum';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 쿠키 옵션을 한 곳에서 관리 — 14일 TTL 변경 시 여기만 수정
  private get refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 14 * 24 * 60 * 60 * 1000,
    };
  }

  @Post('login/:provider')
  async socialLogin(
    @Param('provider') provider: AuthProvider,
    @Body() dto: SocialLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.socialLogin(provider, dto.accessToken);

    res.cookie('refreshToken', refreshToken, this.refreshCookieOptions);
    return { accessToken, user };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 쿠키 객체의 타입을 명시적으로 지정
    const cookies = req.cookies as Record<string, string>;
    const oldRefreshToken = cookies['refreshToken'];
    if (!oldRefreshToken)
      throw new BadRequestException('리프레시 토큰이 없습니다.');

    const { accessToken, newRefreshToken } =
      await this.authService.refresh(oldRefreshToken);

    res.cookie('refreshToken', newRefreshToken, this.refreshCookieOptions);
    return { accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() req: Request & { user: { id: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.id);
    res.clearCookie('refreshToken', this.refreshCookieOptions);
    return { message: '로그아웃 성공' };
  }
}
