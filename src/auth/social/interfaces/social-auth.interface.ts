// 각 소셜 서비스가 무조건 지켜야 할 규약
export interface SocialUserInfo {
  providerId: string;
  name: string;
  email: string;
  provider: 'GOOGLE' | 'KAKAO';
}

export interface ISocialAuthService {
  getUserInfo(token: string): Promise<SocialUserInfo>;
}
