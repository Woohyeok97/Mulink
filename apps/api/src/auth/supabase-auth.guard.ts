import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';

// Bearer JWT 검증 Guard
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user: unknown;
    }>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('인증 토큰이 없습니다.');
    }
    const token = authHeader.slice('Bearer '.length);
    const { data, error } = await this.supabase.getUser(token);
    if (error || !data?.user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
    request.user = data.user;
    return true;
  }
}
