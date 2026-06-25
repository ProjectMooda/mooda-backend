import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  ISocialAuthService,
  SocialUserInfo,
} from './interfaces/social-auth.interface';

interface GoogleUserResponse {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleAuthService implements ISocialAuthService {
  async getUserInfo(token: string): Promise<SocialUserInfo> {
    try {
      // 1. 프론트에서 받은 토큰을 구글 공식 API 서버로 보내서 검증
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      // 구글에서 거절하면 에러 던짐
      if (!response.ok) {
        throw new Error('Google API Token Invalid');
      }

      // 2. 구글에서 준 진짜 유저 정보(프로필) 꺼내기
      const googleUser = (await response.json()) as GoogleUserResponse;

      // 3. 공통 규약(SocialUserInfo)에 맞게 포맷팅하여 반환
      return {
        providerId: googleUser.sub, // 구글의 고유 식별자
        name: googleUser.name || '구글유저',
        email: googleUser.email,
        provider: 'GOOGLE',
      };
    } catch (error) {
      console.error('구글 로그인 에러:', error);
      throw new UnauthorizedException('유효하지 않은 구글 토큰입니다.');
    }
  }
}
