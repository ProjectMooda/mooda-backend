import { AuthProvider } from '../../enums/provider.enum';

export interface SocialUserInfo {
  providerId: string;
  name: string;
  email: string;
  provider: AuthProvider; // 문자열 리터럴 대신 enum으로 단일 출처 유지
}

export interface ISocialAuthService {
  getUserInfo(token: string): Promise<SocialUserInfo>;
}
