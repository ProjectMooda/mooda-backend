import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  ISocialAuthService,
  SocialUserInfo,
} from './interfaces/social-auth.interface';
import { AuthProvider } from '../enums/provider.enum';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  id_token: string;
}

interface GoogleUserResponse {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleAuthService implements ISocialAuthService {
  // =====================================================================
  // 🌟 [추가 1] 구글 로그인 화면 URL 생성 (Electron 딥링크용)
  // =====================================================================
  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      response_type: 'code',
      scope: 'email profile',
      access_type: 'offline', // refresh token을 받기 위해 필요
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  // =====================================================================
  // 🌟 [추가 2] 구글 인가 코드(Code)를 토큰으로 교환 (Electron 딥링크용)
  // =====================================================================
  async exchangeCode(code: string): Promise<SocialUserInfo> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      code,
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      throw new UnauthorizedException('구글 토큰 교환에 실패했습니다.');
    }

    const { access_token } = (await tokenRes.json()) as GoogleTokenResponse;

    // 💡 방금 교환해온 access_token을 아래에 있는 기존 메서드에 넘겨서 검증!
    return this.getUserInfo(access_token);
  }

  // =====================================================================
  // ✅ [유지] 기존 작성하신 코드 (토큰으로 유저 정보 검증)
  // =====================================================================
  async getUserInfo(token: string): Promise<SocialUserInfo> {
    try {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        throw new Error('Google API Token Invalid');
      }

      const googleUser = (await response.json()) as GoogleUserResponse;

      return {
        providerId: googleUser.sub,
        name: googleUser.name || '구글유저',
        email: googleUser.email,
        provider: AuthProvider.GOOGLE,
      };
    } catch (error) {
      console.error('구글 로그인 에러:', error);
      throw new UnauthorizedException('유효하지 않은 구글 토큰입니다.');
    }
  }
}
