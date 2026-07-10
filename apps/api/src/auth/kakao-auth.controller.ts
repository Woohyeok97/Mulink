import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { KakaoOauthService } from './kakao-oauth.service';
import { SupabaseAdminService } from './supabase-admin.service';
import { SessionCodeService } from './session-code.service';
import type { KakaoProfile } from './kakao-profile';

// 로그인 성공/실패 후 사용자를 돌려보낼 web 주소
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

// CSRF 방어용 state를 잠깐 담아둘 쿠키 이름 (일회용 비밀번호)
const STATE_COOKIE = 'kakao_oauth_state';

// 카카오 OAuth 로그인 플로우 입구 (로그인 전이라 가드 미적용)
@Controller('auth/kakao')
export class KakaoAuthController {
  constructor(
    private readonly kakao: KakaoOauthService,
    private readonly admin: SupabaseAdminService,
    private readonly sessionCode: SessionCodeService,
  ) {}

  // 1단계: 동의 화면으로 보내기 전, state를 쿠키에 심고 카카오 authorize URL로 redirect.
  @Get('authorize')
  authorize(@Res() res: Response) {
    const state = randomUUID();
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000, // 5분
    });
    res.redirect(this.kakao.buildAuthorizeUrl(state));
  }

  // 2단계: 카카오가 code/state를 들고 돌아오는 지점 -> 쿠키 state와 쿼리 파라미터 state를 대조해 CSRF를 막고, 통과하면 토큰을 발급
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined, // URL의 쿼리 파라미터에서 code를 추출 (카카오가 보낸 인가코드를 의미)
    @Query('state') state: string | undefined, // URL의 쿼리 파라미터에서 state를 추출 (카카오가 돌려준 state를 의미)
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const cookieState = (req.cookies as Record<string, string | undefined>)[
      STATE_COOKIE
    ];

    // state가 없거나 어긋나면 위조 요청으로 판단
    if (!cookieState || cookieState !== state) {
      res.redirect(`${WEB_ORIGIN}/login?error=state`);
      return;
    }
    // 쿠키 state === 쿼리 파라미터 state 검증을 통과하면 1회용 state 쿠키는 폐기 (set과 동일 옵션으로 확실히 삭제)
    res.clearCookie(STATE_COOKIE, { httpOnly: true, sameSite: 'lax' });

    // state는 맞지만 code가 빠진 비정상 콜백 차단
    if (!code) {
      res.redirect(`${WEB_ORIGIN}/login?error=session`);
      return;
    }

    // 카카오 통신 실패와 Supabase 세션발급 실패를 구분해 에러 코드를 다르게 준다.
    let profile: KakaoProfile;

    try {
      const kakaoToken = await this.kakao.exchangeCodeForToken(code); // code -> 카카오 Access Token 발급
      profile = await this.kakao.getKakaoProfile(kakaoToken); // 카카오 Access Token -> 카카오 프로필 교환
    } catch {
      res.redirect(`${WEB_ORIGIN}/login?error=kakao`);
      return;
    }

    try {
      const sessionTokens = await this.admin.createSessionTokens(profile);
      const sessionCode = this.sessionCode.createSessionCode(sessionTokens);
      res.redirect(`${WEB_ORIGIN}/auth/callback?code=${sessionCode}`);
    } catch {
      res.redirect(`${WEB_ORIGIN}/login?error=session`);
    }
  }
}
