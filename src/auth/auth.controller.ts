// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SocialLoginDto } from './dto/social-login.dto';
import { AuthProvider } from './enums/provider.enum';
import { GoogleAuthService } from './social/google-auth.service';
import { KakaoAuthService } from './social/kakao-auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuth: GoogleAuthService,
    private readonly kakaoAuth: KakaoAuthService,
  ) {}

  // 🚀 통합된 소셜 로그인 엔드포인트
  @Post('login/:provider')
  async socialLogin(
    @Param('provider') provider: AuthProvider,
    @Body() dto: SocialLoginDto,
  ) {
    let userInfo;

    // Factory 역할을 컨트롤러에서 간단히 처리하거나, 별도 Factory 클래스로 뺄 수도 있습니다.
    switch (provider) {
      case AuthProvider.GOOGLE:
        userInfo = await this.googleAuth.getUserInfo(dto.accessToken);
        break;
      case AuthProvider.KAKAO:
        userInfo = await this.kakaoAuth.getUserInfo(dto.accessToken);
        break;
      default:
        throw new BadRequestException('지원하지 않는 로그인 방식입니다.');
    }

    return this.authService.loginOrRegister(userInfo);
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return await this.authService.refresh(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  // 1. req의 타입을 명시적으로 지정
  async logout(@Req() req: Request & { user: { id: string } }) {
    // 2. 이제 req.user.id가 string임을 TS가 알게 됩니다.
    return await this.authService.logout(req.user.id);
  }
}
