// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleAuthService } from './social/google-auth.service';
import { KakaoAuthService } from './social/kakao-auth.service';
@Module({
  imports: [
    // passport 기본 세팅 추가
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  providers: [AuthService, JwtStrategy, GoogleAuthService, KakaoAuthService], // 💡 JwtStrategy 공급자 등록!
  controllers: [AuthController],
  exports: [JwtStrategy, PassportModule], // 💡 다른 모듈에서 가드를 쓸 수 있게 수출하기
})
export class AuthModule {}
