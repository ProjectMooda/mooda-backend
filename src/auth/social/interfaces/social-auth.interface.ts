import { AuthProvider } from '../../enums/provider.enum';

export interface SocialUserInfo {
  providerId: string;
  name: string;
  email: string;
  provider: AuthProvider; // 문자열 리터럴 대신 enum으로 단일 출처 유지
}

export interface ISocialAuthService {
  /** 기존: 프론트에서 받은 토큰으로 유저 정보 조회 */
  getUserInfo(token: string): Promise<SocialUserInfo>;

  /** 신규: 서버사이드 OAuth — Authorization URL 생성 */
  getAuthorizationUrl?(): string;

  /** 신규: 서버사이드 OAuth — code → 유저 정보 교환 */
  exchangeCode?(code: string): Promise<SocialUserInfo>;
}
