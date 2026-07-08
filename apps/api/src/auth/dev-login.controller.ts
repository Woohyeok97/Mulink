// ⚠️ 개발 전용 컨트롤러 (제거 대상). 카카오를 건너뛰고 dev-seed 유저로 로그인한다.
// docs/superpowers/plans/2026-07-03-dev-seed-and-dev-login.md 참고.
import { Controller, Get, NotFoundException, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAdminService } from './supabase-admin.service';
import { SessionCodeService } from './session-code.service';

// 로그인 후 돌려보낼 web 주소 (kakao-auth.controller와 동일 규칙)
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

// dev-seed 유저를 골라내는 표식 (seed.ts의 SEED_PREFIX와 일치)
const SEED_PREFIX = 'dev-seed-';

// 개발 환경이 아니면 이 컨트롤러의 모든 엔드포인트를 막는다 (⚠️ 프로덕션 보안)
function assertDevEnv() {
  if (process.env.NODE_ENV !== 'development') {
    throw new NotFoundException();
  }
}

@Controller('auth/dev')
export class DevLoginController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: SupabaseAdminService,
    private readonly sessionCode: SessionCodeService,
  ) {}

  // 로그인 페이지 드롭다운을 채울 dev-seed 유저 목록
  @Get('users')
  async listDevUsers() {
    assertDevEnv();
    return this.prisma.user.findMany({
      where: { kakaoId: { startsWith: SEED_PREFIX } },
      select: { id: true, nickname: true, role: true },
      orderBy: [{ role: 'asc' }, { kakaoId: 'asc' }],
    });
  }

  // userId로 세션을 발급해 기존 로그인 콜백(/auth/callback)으로 흘려보낸다
  // (카카오 콜백의 세션 발급 이후 단계를 그대로 재사용)
  @Get('login')
  async devLogin(@Query('userId') userId: string, @Res() res: Response) {
    assertDevEnv();

    // 1) userId로 유저 조회 → 세션 발급에 필요한 kakaoId/nickname 확보
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    // 2) 카카오 없이 세션 토큰 발급 → 1회용 코드로 감싸 콜백으로 redirect
    const sessionTokens = await this.admin.createSessionTokens({
      kakaoId: user.kakaoId,
      nickname: user.nickname,
    });
    const code = this.sessionCode.createSessionCode(sessionTokens);
    res.redirect(`${WEB_ORIGIN}/auth/callback?code=${code}`);
  }
}
