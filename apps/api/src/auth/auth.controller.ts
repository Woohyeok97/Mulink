import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

// Controller: 요청이 들어오는 입구 -> 어떤 URL에 어떤 메서드로 요청이 오면, 어떤 함수를 실행할지"를 연결(매핑)해주는 역할
type AuthedRequest = { user: SupabaseUser };

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 첫 로그인 시 호출: auth.users.id(UUID)로 public.User를 만든다.
  @Post()
  async upsertUser(@Req() req: AuthedRequest) {
    return this.authService.upsertUser(req.user);
  }

  // 보호 엔드포인트: JWT 검증 후 내 User 반환.
  @Get('me')
  async getMe(@Req() req: AuthedRequest) {
    return this.authService.getMe(req.user.id);
  }
}
