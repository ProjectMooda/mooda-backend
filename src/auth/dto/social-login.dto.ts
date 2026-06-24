import { IsNotEmpty, IsString } from 'class-validator';

export class SocialLoginDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string; // 구글이나 카카오 앱 SDK에서 받아온 진짜 토큰
}
