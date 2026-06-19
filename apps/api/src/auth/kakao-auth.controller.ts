import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { KakaoOauthService } from './kakao-oauth.service';
import { SupabaseAdminService } from './supabase-admin.service';
import { SessionTicketService } from './session-ticket.service';

// 로그인 성공/실패 후 사용자를 돌려보낼 web 주소.
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
// CSRF 방어용 state를 잠깐 담아둘 쿠키 이름.
const STATE_COOKIE = 'kakao_oauth_state';

// 카카오 OAuth 로그인 플로우 입구. (로그인 전이라 가드 미적용)
@Controller('auth/kakao')
export class KakaoAuthController {
  constructor(
    private readonly kakao: KakaoOauthService,
    private readonly admin: SupabaseAdminService,
    private readonly tickets: SessionTicketService,
  ) {}

  // 동의 화면으로 보내기 전, state를 쿠키에 심고 카카오 authorize URL로 redirect.
  @Get('login')
  login(@Res() res: Response) {
    const state = randomUUID();
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000, // 5분
    });
    res.redirect(this.kakao.buildAuthorizeUrl(state));
  }

  // 카카오가 code/state를 들고 돌아오는 지점.
  // 쿠키 state와 query state를 대조해 CSRF를 막고, 통과하면 세션을 발급한다.
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const cookieState = req.cookies?.[STATE_COOKIE];
    // state가 없거나 어긋나면 위조 요청으로 보고 거른다.
    if (!cookieState || cookieState !== state) {
      res.redirect(`${WEB_ORIGIN}/login?error=state`);
      return;
    }
    // 검증을 통과했으니 1회용 state 쿠키는 즉시 폐기.
    res.clearCookie(STATE_COOKIE);

    try {
      const kakaoToken = await this.kakao.exchangeCodeForToken(code);
      const profile = await this.kakao.fetchUserInfo(kakaoToken);
      const tokens = await this.admin.issueSession(profile);
      const ticket = this.tickets.issue(tokens);
      res.redirect(`${WEB_ORIGIN}/auth/callback?ticket=${ticket}`);
    } catch {
      res.redirect(`${WEB_ORIGIN}/login?error=session`);
    }
  }
}
