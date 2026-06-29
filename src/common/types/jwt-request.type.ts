import type { Request } from 'express';

/**
 * JWT 인증 통과 후 req.user가 주입된 확장 Request 타입.
 * JwtAuthGuard를 사용하는 모든 컨트롤러에서 공유.
 */
export interface JwtRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}
