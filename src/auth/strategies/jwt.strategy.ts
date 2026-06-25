// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

// 토큰 복하화 후 나올 페이로드 규격 정의 (ESLint 방어)
interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      // 1. 헤더의 Bearer Token 항목에서 JWT를 추출하도록 설정
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // 토큰 만료 시간 엄격하게 체크
      secretOrKey:
        process.env.JWT_SECRET || 'my-super-secret-access-key-change-me-later',
    });
  }

  // 위 유효성 검증을 통과하면 실행되는 메서드
  async validate(payload: JwtPayload) {
    console.log('🔥 [전략] 검증 시작! 요청 헤더 확인 중...'); // 👈 여기 추가

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('존재하지 않는 유저입니다.');
    }

    console.log('✅ [전략] 인증 성공! 유저:', user.id); // 👈 여기 추가
    return { id: user.id, email: user.email };
  }
}
