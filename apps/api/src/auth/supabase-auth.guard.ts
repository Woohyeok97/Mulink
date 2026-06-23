import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';

interface GuardRequest {
  headers: { authorization?: string };
  user: unknown;
}

// Bearer JWT 인증(Authentication)용 Guard
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardRequest>();

    // 1. Authorization 헤더에서 Bearer 토큰 추출
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('인증 토큰이 없습니다.');
    }
    const token = authHeader.slice('Bearer '.length);

    // 2. Supabase 서버에 토큰 위임 검증
    const { data, error } = await this.supabase.getUser(token);
    if (error || !data?.user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    // 3. 검증된 유저를 request에 심어 이후 컨트롤러에서 꺼내 쓸 수 있게 함
    request.user = data.user;
    return true;
  }
}
