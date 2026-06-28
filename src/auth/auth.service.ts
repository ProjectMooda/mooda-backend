import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleAuthService } from './social/google-auth.service';
import { KakaoAuthService } from './social/kakao-auth.service';
import { AuthProvider } from './enums/provider.enum';
import { AuthProvider as PrismaAuthProvider } from '@prisma/client';
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

  /** 서버사이드 OAuth — Authorization Code로 로그인 */
  async socialLoginWithCode(provider: AuthProvider, code: string) {
    const service = this.getSocialService(provider);

    if (!service.exchangeCode) {
      throw new UnauthorizedException(
        `${provider}는 서버사이드 코드 교환을 지원하지 않습니다.`,
      );
    }

    const userInfo = await service.exchangeCode(code);
    return this.loginOrRegister(userInfo);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Access + Refresh 토큰 쌍 발급 */
  private issueTokens(payload: { sub: string; email: string }) {
    return {
      accessToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '10s',
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
    // 계정 판별식 -> 이메일과 provider(social 정보)로 같은 계정인지 구분
    let user = await this.prisma.user.findFirst({
      where: {
        email: userInfo.email,
        provider: userInfo.provider.toUpperCase() as PrismaAuthProvider,
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: userInfo.providerId,
          email: userInfo.email,
          provider: userInfo.provider.toUpperCase() as PrismaAuthProvider,
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

  /**프로필 데이터 조합 로직
   * 프론트엔드가 할 일을 백엔드가 대신 처리해서 완제품을 줍니다.
   */
  async getProfile(userId: string) {
    // 1. DB에서 해당 유저 찾기
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        provider: true,
      },
    });

    // 2. 유저가 없으면 에러 (토큰은 있는데 DB에서 삭제된 유저일 경우 등)
    if (!user) {
      throw new UnauthorizedException('존재하지 않는 유저입니다.');
    }

    // 3. 프론트엔드에서 보여주기 좋게 데이터 가공 (Fallback 로직)
    // 💡 나중에 DB에 nickname 컬럼을 추가하면 user.nickname을 우선적으로 쓰면 됩니다.
    const nickname = user.email.split('@')[0];
    const avatarText = user.email.charAt(0).toUpperCase();

    // 4. 완제품 JSON 리턴
    return {
      id: user.id,
      email: user.email,
      provider: user.provider,
      nickname, // 프론트에서 닉네임으로 사용
      avatarText, // 프론트에서 동그란 프로필 사진 텍스트로 사용
      subscription: 'free', // 향후 결제 시스템 연동 시 활용할 플랜 정보
    };
  }
}
