import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';

@Module({
  // 💡 여기서 JwtModule을 세팅해줘야 AuthService에서 에러 없이 토큰을 구울 수 있어!
  imports: [
    JwtModule.register({
      // 비밀키는 .env에서 가져오고, 없으면 임시 키 사용
      secret: process.env.JWT_SECRET || 'my-super-secret-access-key-change-me-later',
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
