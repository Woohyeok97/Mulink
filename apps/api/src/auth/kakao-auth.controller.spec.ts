import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { KakaoAuthController } from './kakao-auth.controller';
import { SessionController } from './session.controller';
import { KakaoOauthService } from './kakao-oauth.service';
import { SupabaseAdminService } from './supabase-admin.service';
import { SessionCodeService } from './session-code.service';

describe('KakaoAuthController', () => {
  const kakao = {
    buildAuthorizeUrl: jest.fn(),
    exchangeCodeForToken: jest.fn(),
    getKakaoProfile: jest.fn(),
  } as unknown as KakaoOauthService;
  const admin = {
    createSessionTokens: jest.fn(),
  } as unknown as SupabaseAdminService;
  const sessionCode = {
    createSessionCode: jest.fn(),
    consumeSessionCode: jest.fn(),
  } as unknown as SessionCodeService;

  const controller = new KakaoAuthController(kakao, admin, sessionCode);

  // Express Response/Request mock 생성기
  const makeRes = () =>
    ({
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    }) as unknown as Response;
  const makeReq = (cookies: Record<string, string>) =>
    ({ cookies }) as unknown as Request;

  beforeEach(() => jest.clearAllMocks());

  it('authorize: state 쿠키를 굽고 buildAuthorizeUrl 결과로 redirect한다', () => {
    (kakao.buildAuthorizeUrl as jest.Mock).mockReturnValue(
      'https://kauth.kakao.com/authorize',
    );
    const res = makeRes();

    controller.authorize(res);

    expect(res.cookie).toHaveBeenCalledWith(
      'kakao_oauth_state',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      'https://kauth.kakao.com/authorize',
    );
  });

  it('callback: state 불일치면 /login?error=state로 redirect한다', async () => {
    const req = makeReq({ kakao_oauth_state: 'cookie-state' });
    const res = makeRes();

    await controller.callback('code-1', 'query-state', req, res);

    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/login?error=state'),
    );
    expect(admin.createSessionTokens).not.toHaveBeenCalled();
  });

  it('callback: query state가 없으면(누락) /login?error=state로 거른다', async () => {
    const req = makeReq({ kakao_oauth_state: 'cookie-state' });
    const res = makeRes();

    await controller.callback('code-1', undefined, req, res);

    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/login?error=state'),
    );
    expect(admin.createSessionTokens).not.toHaveBeenCalled();
  });

  it('callback: state 일치면 세션 발급 후 /auth/callback?code=...로 redirect한다', async () => {
    (kakao.exchangeCodeForToken as jest.Mock).mockResolvedValue('kakao-token');
    (kakao.getKakaoProfile as jest.Mock).mockResolvedValue({
      kakaoId: '1',
      nickname: '홍길동',
    });
    (admin.createSessionTokens as jest.Mock).mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
    });
    (sessionCode.createSessionCode as jest.Mock).mockResolvedValue('code-1');
    const req = makeReq({ kakao_oauth_state: 'same-state' });
    const res = makeRes();

    await controller.callback('code-1', 'same-state', req, res);

    expect(admin.createSessionTokens).toHaveBeenCalledWith({
      kakaoId: '1',
      nickname: '홍길동',
    });
    expect(res.clearCookie).toHaveBeenCalledWith(
      'kakao_oauth_state',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/auth/callback?code=code-1'),
    );
  });
});

describe('SessionController', () => {
  const sessionCode = {
    createSessionCode: jest.fn(),
    consumeSessionCode: jest.fn(),
  } as unknown as SessionCodeService;
  const controller = new SessionController(sessionCode);

  beforeEach(() => jest.clearAllMocks());

  it('exchangeSessionCode: 코드가 유효하면 토큰을 반환한다', async () => {
    (sessionCode.consumeSessionCode as jest.Mock).mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
    });

    const result = await controller.exchangeSessionCode({ code: 'code-1' });

    expect(sessionCode.consumeSessionCode).toHaveBeenCalledWith('code-1');
    expect(result).toEqual({ accessToken: 'at', refreshToken: 'rt' });
  });

  it('exchangeSessionCode: consume이 null이면 UnauthorizedException을 던진다', async () => {
    (sessionCode.consumeSessionCode as jest.Mock).mockResolvedValue(null);

    await expect(
      controller.exchangeSessionCode({ code: 'bad' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
