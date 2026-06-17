import {
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { extractKakaoProfile } from './kakao-profile';

type AuthedRequest = { user: SupabaseUser };

@Controller('auth')
@UseGuards(SupabaseAuthGuard)
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  // 첫 로그인 시 호출: auth.users.id(UUID)로 public.User를 만든다.
  @Post('sync')
  async sync(@Req() req: AuthedRequest) {
    const { kakaoId, nickname } = extractKakaoProfile(req.user);
    return this.prisma.user.upsert({
      where: { id: req.user.id },
      create: { id: req.user.id, kakaoId, nickname },
      update: {},
    });
  }

  // 보호 엔드포인트: JWT 검증 후 내 User 반환.
  @Get('me')
  async me(@Req() req: AuthedRequest) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    return user;
  }
}
