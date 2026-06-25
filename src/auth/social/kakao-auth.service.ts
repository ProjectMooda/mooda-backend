import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  ISocialAuthService,
  SocialUserInfo,
} from './interfaces/social-auth.interface';
import { AuthProvider } from '../enums/provider.enum';

// 💡 카카오 응답 규격에 profile.nickname 추가
interface KakaoUserInfo {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string; // 카카오에서 주는 닉네임
    };
  };
}

@Injectable()
export class KakaoAuthService implements ISocialAuthService {
  async getUserInfo(token: string): Promise<SocialUserInfo> {
    try {
      const response = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
      });

      if (!response.ok) throw new Error('Kakao API Token Invalid');

      const kakaoUser = (await response.json()) as KakaoUserInfo;

      const email =
        kakaoUser.kakao_account?.email || `kakao_${kakaoUser.id}@temp.com`;
      // 💡 카카오 닉네임 추출 (없을 경우 임시 이름 부여)
      const name =
        kakaoUser.kakao_account?.profile?.nickname ||
        `카카오유저_${kakaoUser.id}`;

      return {
        providerId: kakaoUser.id.toString(),
        email: email,
        name: name, // 👈 이름 매핑
        provider: AuthProvider.KAKAO,
      };
    } catch {
      throw new UnauthorizedException('유효하지 않은 카카오 토큰입니다.');
    }
  }
}
