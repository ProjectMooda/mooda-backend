import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SocialLoginDto {
  @ApiProperty({
    example: 'ya29.a0AfB_byC...', // 실제 토큰과 비슷한 예시
    description: '구글 또는 카카오 앱 SDK에서 발급받은 액세스 토큰',
  })
  @IsString()
  @IsNotEmpty()
  accessToken!: string;
}
