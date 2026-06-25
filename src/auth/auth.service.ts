import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleAuthService } from './social/google-auth.service';
import { KakaoAuthService } from './social/kakao-auth.service';
import { AuthProvider } from './enums/provider.enum';
import {
  ISocialAuthService,
  SocialUserInfo,
} from './social/interfaces/social-auth.interface';

@Injectable()
export class AuthService {
  // 쿠키 maxAge(ms)와 동일한 14일 — 여기서 단일 관리
  private static readonly REFRESH_TTL_SEC = 14 * 24 * 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @InjectRedis() private readonly redis: Redis,
    private readonly googleAuth: GoogleAuthService,
    private readonly kakaoAuth: KakaoAuthService,
  ) {}

  // ── Private helpers ────────────────────────────────────────────────────────

  /** 프로바이더 → 소셜 서비스 선택 (전략 패턴) */
  private getSocialService(provider: AuthProvider): ISocialAuthService {
    const map: Partial<Record<AuthProvider, ISocialAuthService>> = {
      [AuthProvider.GOOGLE]: this.googleAuth,
      [AuthProvider.KAKAO]: this.kakaoAuth,
    };
    const service = map[provider];
    if (!service) {
      throw new UnauthorizedException(`지원하지 않는 소셜 로그인: ${provider}`);
    }
    return service;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Access + Refresh 토큰 쌍 발급 */
  private issueTokens(payload: { sub: string; email: string }) {
    return {
      accessToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '1h',
      }),
      refreshToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '14d',
      }),
    };
  }

  /** Refresh Token 해싱 후 Redis 저장 */
  private async persistRefreshToken(
    userId: string,
    token: string,
  ): Promise<void> {
    await this.redis.set(
      `refreshToken:${userId}`,
      this.hashToken(token),
      'EX',
      AuthService.REFRESH_TTL_SEC,
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** 소셜 로그인 진입점 — 프로바이더 선택 후 공통 로직에 위임 */
  async socialLogin(provider: AuthProvider, socialAccessToken: string) {
    const userInfo =
      await this.getSocialService(provider).getUserInfo(socialAccessToken);
    return this.loginOrRegister(userInfo);
  }

  /** DB upsert 후 토큰 발급 */
  private async loginOrRegister(userInfo: SocialUserInfo) {
    let user = await this.prisma.user.findFirst({
      where: { email: userInfo.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: userInfo.providerId,
          email: userInfo.email,
          provider:
            userInfo.provider as unknown as import('@prisma/client').AuthProvider,
        },
      });
    }

    const payload = { sub: user.id, email: user.email };
    const { accessToken, refreshToken } = this.issueTokens(payload);
    await this.persistRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email },
    };
  }

  /** Refresh Token Rotation */
  async refresh(oldRefreshToken: string) {
    // 1. JWT 서명·만료 검증 — 실패 원인을 분리해서 잡기
    let payload: { sub: string; email: string };
    try {
      payload = this.jwtService.verify<{ sub: string; email: string }>(
        oldRefreshToken,
        { secret: process.env.JWT_REFRESH_SECRET },
      );
    } catch {
      throw new UnauthorizedException(
        '만료되었거나 유효하지 않은 토큰입니다. 다시 로그인하세요.',
      );
    }

    // 2. Redis에서 저장된 해시 조회
    const storedHash = await this.redis.get(`refreshToken:${payload.sub}`);
    if (!storedHash) {
      throw new UnauthorizedException(
        '세션이 만료되었습니다. 다시 로그인하세요.',
      );
    }

    // 3. 해시 비교 — 불일치 시 탈취 의심으로 세션 전체 무효화
    if (this.hashToken(oldRefreshToken) !== storedHash) {
      await this.redis.del(`refreshToken:${payload.sub}`);
      throw new UnauthorizedException(
        '비정상적인 접근이 감지되어 로그아웃 처리되었습니다.',
      );
    }

    // 4. Rotation: 새 토큰 쌍 발급 + Redis 갱신
    const { accessToken, refreshToken: newRefreshToken } = this.issueTokens({
      sub: payload.sub,
      email: payload.email,
    });
    await this.persistRefreshToken(payload.sub, newRefreshToken);

    return { accessToken, newRefreshToken };
  }

  async logout(userId: string): Promise<void> {
    await this.redis.del(`refreshToken:${userId}`);
  }
}
