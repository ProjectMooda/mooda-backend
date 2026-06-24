// src/auth/auth.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SocialLoginDto } from './dto/social-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 구글 로그인
  @Post('google')
  async googleLogin(@Body() dto: SocialLoginDto) {
    return this.authService.validateGoogleUser(dto.accessToken);
  }

  // 카카오 로그인
  @Post('kakao')
  async kakaoLogin(@Body() dto: SocialLoginDto) {
    return this.authService.validateKakaoUser(dto.accessToken);
  }
}
