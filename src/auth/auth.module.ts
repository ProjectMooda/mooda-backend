import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleAuthService } from './social/google-auth.service';
import { KakaoAuthService } from './social/kakao-auth.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({ secret: process.env.JWT_SECRET }),
    PrismaModule,
    // Redis는 AppModule에서 RedisModule.forRootAsync()로 전역 등록 권장
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleAuthService, KakaoAuthService],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}
