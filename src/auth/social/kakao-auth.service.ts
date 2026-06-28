import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  ISocialAuthService,
  SocialUserInfo,
} from './interfaces/social-auth.interface';
import { AuthProvider } from '../enums/provider.enum';

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface KakaoUserInfo {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: { nickname?: string };
  };
}

@Injectable()
export class KakaoAuthService implements ISocialAuthService {
  // ── 신규: Authorization URL 생성 ──────────────────────────────────────────

  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.KAKAO_CLIENT_ID!,
      redirect_uri: process.env.KAKAO_REDIRECT_URI!,
      response_type: 'code',
    });
    return `https://kauth.kakao.com/oauth/authorize?${params}`;
  }

  // ── 신규: Authorization Code → 유저 정보 교환 ────────────────────────────

  async exchangeCode(code: string): Promise<SocialUserInfo> {
    // 1단계: code → 카카오 액세스 토큰
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_CLIENT_ID!,
      redirect_uri: process.env.KAKAO_REDIRECT_URI!,
      code,
      ...(process.env.KAKAO_CLIENT_SECRET && {
        client_secret: process.env.KAKAO_CLIENT_SECRET,
      }),
    });

    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      throw new UnauthorizedException('카카오 토큰 교환에 실패했습니다.');
    }

    const { access_token } = (await tokenRes.json()) as KakaoTokenResponse;

    // 2단계: 카카오 액세스 토큰 → 유저 정보
    return this.getUserInfo(access_token);
  }

  // ── 기존: 액세스 토큰으로 유저 정보 조회 (그대로 유지) ────────────────────

  async getUserInfo(token: string): Promise<SocialUserInfo> {
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    if (!response.ok)
      throw new UnauthorizedException('유효하지 않은 카카오 토큰입니다.');

    const kakaoUser = (await response.json()) as KakaoUserInfo;

    return {
      providerId: kakaoUser.id.toString(),
      email: kakaoUser.kakao_account?.email ?? `kakao_${kakaoUser.id}@temp.com`,
      name:
        kakaoUser.kakao_account?.profile?.nickname ??
        `카카오유저_${kakaoUser.id}`,
      provider: AuthProvider.KAKAO,
    };
  }
}
