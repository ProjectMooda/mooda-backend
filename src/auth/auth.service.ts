// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

// 💡 [추가] 구글에서 받아올 데이터의 모양을 명확하게 정의합니다.
interface GoogleUserInfo {
  sub: string;
  email: string;
}

interface KakaoUserInfo {
  id: number;
  kakao_account?: {
    email?: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // 🔵 구글 토큰 검증 로직 완성!
  async validateGoogleUser(googleToken: string) {
    try {
      // 1. 프론트에서 받은 토큰을 구글 공식 API 서버로 보내서 검증
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${googleToken}` },
        },
      );

      // 구글에서 빠꾸먹으면 에러 던짐
      if (!response.ok) {
        throw new Error('Google API Token Invalid');
      }

      // 2. 구글에서 준 진짜 유저 정보(프로필) 꺼내기
      const googleUser = (await response.json()) as GoogleUserInfo;

      // 3. DB 처리 및 우리 서버용 토큰 발급으로 넘김
      return this.loginOrRegister({
        providerId: googleUser.sub, // 구글의 고유 식별자
        email: googleUser.email,
        provider: 'GOOGLE',
      });
    } catch (error) {
      console.error('구글 로그인 에러:', error);
      throw new UnauthorizedException('유효하지 않은 구글 토큰입니다.');
    }
  }

  // 🟡 카카오 토큰 검증 (일단 뼈대만, 구글 성공하면 바로 짤 예정)
  async validateKakaoUser(kakaoToken: string) {
    try {
      // 1. 카카오 공식 API 서버로 검증 요청
      const response = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          Authorization: `Bearer ${kakaoToken}`,
          'Content-type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
      });

      if (!response.ok) {
        throw new Error('Kakao API Token Invalid');
      }

      // 2. 카카오 유저 정보 꺼내기
      const kakaoUser = (await response.json()) as KakaoUserInfo;

      // 💡 카카오는 유저가 이메일 제공을 거부할 수도 있어서, 없을 경우 가짜 이메일 생성 방어 코드 추가
      const email =
        kakaoUser.kakao_account?.email || `kakao_${kakaoUser.id}@temp.com`;

      // 3. DB 처리 및 토큰 발급으로 넘김
      return this.loginOrRegister({
        providerId: kakaoUser.id.toString(), // 카카오 ID는 숫자라서 문자로 변환
        email: email,
        provider: 'KAKAO',
      });
    } catch (error) {
      console.error('카카오 로그인 에러:', error);
      throw new UnauthorizedException('유효하지 않은 카카오 토큰입니다.');
    }
  }

  // 🟢 DB 연동 & Access / Refresh 토큰 발급 로직
  private async loginOrRegister(userParam: {
    providerId: string;
    email: string;
    provider: 'GOOGLE' | 'KAKAO';
  }) {
    // 1. 기존에 가입된 유저인지 이메일로 확인
    let user = await this.prisma.user.findFirst({
      where: { email: userParam.email },
    });

    // 2. 처음 온 유저라면 DB에 새로 생성 (회원가입)
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: userParam.providerId, // 소셜 고유 ID를 우리 DB의 PK로 쓰거나 따로 저장
          email: userParam.email,
          provider: userParam.provider,
        },
      });
    }

    // 3. 보안의 핵심! 두 가지 JWT 토큰 발급
    const payload = { sub: user.id, email: user.email };

    // - Access Token (1시간 뒤 만료)
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '1h',
    });

    // - Refresh Token (2주 뒤 만료)
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '14d',
    });

    // TODO: 원래는 여기서 Refresh Token을 User 테이블이나 Redis에 저장해야 완벽해. (이건 인증 통과하면 바로 붙이자!)

    // 4. 프론트엔드로 토큰 두 개 다 던져줌
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }
}
