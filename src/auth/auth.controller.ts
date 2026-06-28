import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  BadRequestException,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SocialLoginDto } from './dto/social-login.dto';
import { AuthProvider } from './enums/provider.enum';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { KakaoAuthService } from './social/kakao-auth.service';
import { GoogleAuthService } from './social/google-auth.service';

@ApiTags('Auth (인증)')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly kakaoAuth: KakaoAuthService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  // 쿠키 옵션을 한 곳에서 관리 — 14일 TTL 변경 시 여기만 수정
  private get refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 14 * 24 * 60 * 60 * 1000,
    };
  }

  // 앱에서는 깔려있는 네이티브 앱들을 이용할거라 앱만 사용함
  @ApiOperation({
    summary: '소셜 로그인',
    description:
      '구글, 카카오 등의 액세스 토큰을 받아 로그인 및 회원가입을 처리합니다. 성공 시 헤더(Cookie)에 Refresh Token이 담깁니다.',
  })
  @ApiParam({
    name: 'provider',
    enum: AuthProvider,
    description: '소셜 로그인 제공자 (예: google, kakao)',
  })
  @ApiResponse({ status: 201, description: '로그인 성공 (accessToken 반환)' })
  @ApiResponse({ status: 400, description: '유효하지 않은 소셜 토큰' })
  @Post('login/:provider')
  async socialLogin(
    @Param('provider') provider: AuthProvider,
    @Body() dto: SocialLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.socialLogin(provider, dto.accessToken);

    res.cookie('refreshToken', refreshToken, this.refreshCookieOptions);
    return { accessToken, user };
  }

  @ApiOperation({
    summary: '액세스 토큰 갱신',
    description:
      '쿠키에 저장된 Refresh Token을 검증하고, 새로운 Access Token과 Refresh Token을 발급합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '토큰 갱신 성공 (새로운 accessToken 반환)',
  })
  @ApiResponse({ status: 400, description: '리프레시 토큰이 없습니다.' })
  @ApiResponse({
    status: 401,
    description: '만료되거나 유효하지 않은 리프레시 토큰',
  })
  @ApiOperation({
    summary: '액세스 토큰 갱신',
    description:
      '웹(Cookie) 또는 데스크톱(Body) 토큰을 검증하고 새 토큰을 발급합니다.',
  })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-client-type') clientType?: string, // 👈 클라이언트 종류 파악
    @Body('refreshToken') bodyRefreshToken?: string, // 👈 Electron은 Body로 전송
  ) {
    const cookies = req.cookies as Record<string, string>;

    // 1. 토큰 찾기: Body에 있으면 쓰고, 없으면 쿠키에서 찾음
    const oldRefreshToken = bodyRefreshToken || cookies?.['refreshToken'];

    if (!oldRefreshToken) {
      throw new BadRequestException('리프레시 토큰이 없습니다.');
    }

    // 2. 서비스 호출 (기존 로직 동일)
    const { accessToken, newRefreshToken } =
      await this.authService.refresh(oldRefreshToken);

    // 3. 웹 클라이언트를 위해 무조건 쿠키는 구워줌
    res.cookie('refreshToken', newRefreshToken, this.refreshCookieOptions);

    // 4. 🌟 핵심: Electron 클라이언트라면 Body에도 새 리프레시 토큰을 담아서 줌
    if (clientType === 'electron') {
      return { accessToken, refreshToken: newRefreshToken };
    }

    // 웹 브라우저라면 보안상 accessToken만 반환
    return { accessToken };
  }

  @ApiBearerAuth() // 이 API는 Header에 Bearer 토큰이 필요함을 명시합니다.
  @ApiOperation({
    summary: '로그아웃',
    description:
      '현재 로그인된 사용자의 세션을 종료하고, 쿠키의 Refresh Token을 삭제합니다.',
  })
  @ApiResponse({ status: 201, description: '로그아웃 성공' })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자 (Access Token 누락/만료)',
  })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() req: Request & { user: { id: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.id);
    res.clearCookie('refreshToken', this.refreshCookieOptions);
    return { message: '로그아웃 성공' };
  }

  // electorn에서 사용하는 카카오 redirect login
  @ApiOperation({ summary: '카카오 로그인 시작 (서버사이드 OAuth)' })
  @Get('kakao')
  kakaoRedirect(@Res() res: Response) {
    const url = this.kakaoAuth.getAuthorizationUrl();
    return (res as any).redirect(url);
  }

  @ApiOperation({ summary: '카카오 OAuth 콜백 처리' })
  @ApiResponse({ status: 302, description: 'Electron 딥링크로 리다이렉트' })
  @Get('kakao/callback')
  async kakaoCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const scheme = process.env.ELECTRON_SCHEME; // e.g. "yourapp"

    // 카카오에서 에러 반환 시 (사용자 취소 등)
    if (error || !code) {
      return (res as any).redirect(
        `${scheme}://auth/error?message=${encodeURIComponent(error ?? 'unknown')}`,
      );
    }

    const { accessToken, refreshToken, user } =
      await this.authService.socialLoginWithCode(AuthProvider.KAKAO, code);

    // Electron 커스텀 프로토콜로 토큰 전달
    // Electron 쪽에서 yourapp://auth/callback 을 인터셉트해서 토큰 저장
    const params = new URLSearchParams({
      accessToken,
      refreshToken, // Electron은 keytar 등 안전한 스토리지에 저장 권장
      userId: user.id,
      email: user.email,
    });

    const redirectUrl = `${scheme}://auth/callback?${params.toString()}`;
    console.log(
      '🚀 [1단계 백엔드] Electron으로 리다이렉트 쏩니다:',
      redirectUrl,
    ); // 👈 이 로그 추가

    return (res as any).redirect(`${scheme}://auth/callback?${params}`);
  }

  // =====================================================================
  // electron 구글 로그인
  // =====================================================================

  @ApiOperation({ summary: '구글 로그인 시작 (서버사이드 OAuth)' })
  @Get('google')
  googleRedirect(@Res() res: Response) {
    // 💡 주의: GoogleAuthService에 getAuthorizationUrl() 메서드가 구현되어 있어야 합니다!
    const url = this.googleAuth.getAuthorizationUrl();
    return (res as any).redirect(url);
  }

  @ApiOperation({ summary: '구글 OAuth 콜백 처리' })
  @ApiResponse({ status: 302, description: 'Electron 딥링크로 리다이렉트' })
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const scheme = process.env.ELECTRON_SCHEME;

    // 구글에서 에러 반환 시 (사용자 취소 등)
    if (error || !code) {
      return (res as any).redirect(
        `${scheme}://auth/error?message=${encodeURIComponent(error ?? 'unknown')}`,
      );
    }

    // 구글 코드를 이용해 백엔드에서 토큰 교환 및 유저 가입/로그인 처리
    const { accessToken, refreshToken, user } =
      await this.authService.socialLoginWithCode(AuthProvider.GOOGLE, code);

    // Electron으로 넘겨줄 파라미터 조합
    const params = new URLSearchParams({
      accessToken,
      refreshToken,
      userId: user.id,
      email: user.email,
    });

    const redirectUrl = `${scheme}://auth/callback?${params.toString()}`;
    console.log(
      '🚀 [구글 로그인] Electron으로 리다이렉트 쏩니다:',
      redirectUrl,
    );

    return res.send(`
      <html>
        <body>
          <script>
            // 1. 딥링크 호출 (앱이 열림)
            window.location.href = "${redirectUrl}";
            
            // 2. 1초 뒤에 브라우저 창 닫기 시도
            setTimeout(() => {
              window.close();
            }, 1000);
          </script>
          <h3>로그인 성공! 창이 자동으로 닫힙니다.</h3>
        </body>
      </html>
    `);
  }

  // =====================================================================
  // 내 프로필 조회 API
  // =====================================================================
  @ApiBearerAuth() // Swagger 문서에 JWT 토큰이 필요함을 명시합니다.
  @ApiOperation({
    summary: '내 프로필 조회',
    description:
      '현재 로그인한 유저의 프로필 정보(이메일, 닉네임, 아바타 등)를 반환합니다.',
  })
  @ApiResponse({ status: 200, description: '프로필 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 실패 (토큰 누락 및 만료)' })
  @UseGuards(JwtAuthGuard) // 👈 인가(Authorization): JWT 토큰이 유효한 유저만 접근 가능하게 막는 자물쇠
  @Get('profile')
  async getProfile(@Req() req: Request & { user: { id: string } }) {
    // 💡 JwtAuthGuard를 통과했다면, req.user 안에 strategy에서 반환한 id가 무조건 들어있습니다.
    // 이 id를 통해 서비스 계층에서 DB를 조회하고 완성된 프로필 데이터를 던져줍니다.
    return this.authService.getProfile(req.user.id);
  }
}
