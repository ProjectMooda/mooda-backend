import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SocialLoginDto {
  @ApiProperty({
    example: 'google-access-token',
    description: '구글 또는 카카오 액세스 토큰',
  })
  @IsString()
  @IsNotEmpty()
  accessToken!: string; // 구글이나 카카오 앱 SDK에서 받아온 진짜 토큰
}
