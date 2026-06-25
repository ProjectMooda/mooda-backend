// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { SocialUserInfo } from './social/interfaces/social-auth.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // 🟢 소셜 로그인/가입 통합 로직
  async loginOrRegister(userInfo: SocialUserInfo) {
    let user = await this.prisma.user.findFirst({
      where: { email: userInfo.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: userInfo.providerId,
          email: userInfo.email,
          provider: userInfo.provider,
        },
      });
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '1h',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '14d',
    });

    const hashedRefreshToken = this.hashToken(refreshToken);
    await this.redis.set(
      `refreshToken:${user.id}`,
      hashedRefreshToken,
      'EX',
      1209600,
    );

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email },
    };
  }

  // 🟣 Redis 기반 토큰 갱신 로직
  async refresh(refreshToken: string) {
    try {
      // 1. 토큰 자체 유효성 및 만료일 검증
      const payload = this.jwtService.verify<{ sub: string; email: string }>(
        refreshToken,
        { secret: process.env.JWT_REFRESH_SECRET },
      );

      // 2. Redis에서 해당 유저의 해싱된 리프레시 토큰 꺼내오기 (DB 조회 안 함!)
      const storedHashedToken = await this.redis.get(
        `refreshToken:${payload.sub}`,
      );

      if (!storedHashedToken) {
        throw new UnauthorizedException(
          '세션이 만료되었습니다. 다시 로그인하세요.',
        );
      }

      // 3. 프론트가 보낸 토큰을 똑같이 해싱해서 Redis 값과 비교
      const hashedInputToken = this.hashToken(refreshToken);
      if (hashedInputToken !== storedHashedToken) {
        // 해커의 탈취 시도로 의심될 경우 얄짤없이 기존 세션 폭파!
        await this.redis.del(`refreshToken:${payload.sub}`);
        throw new UnauthorizedException('비정상적인 접근입니다.');
      }

      // 4. 안전함이 증명되었으니 새 Access Token 발급
      const newAccessToken = this.jwtService.sign(
        { sub: payload.sub, email: payload.email },
        { secret: process.env.JWT_SECRET, expiresIn: '1h' },
      );

      return { accessToken: newAccessToken };
    } catch {
      throw new UnauthorizedException('리프레시 실패: 다시 로그인하세요.');
    }
  }

  async logout(userId: string) {
    // 유저의 고유 ID로 저장된 리프레시 토큰 키를 Redis에서 즉시 삭제!
    await this.redis.del(`refreshToken:${userId}`);
    return { message: '성공적으로 로그아웃 되었습니다.' };
  }
}
