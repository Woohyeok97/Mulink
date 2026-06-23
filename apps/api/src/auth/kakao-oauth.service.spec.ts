import { KakaoOauthService } from './kakao-oauth.service';

describe('KakaoOauthService', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      KAKAO_REST_API_KEY: 'rest-key',
      KAKAO_CLIENT_SECRET: 'secret',
      KAKAO_REDIRECT_URI: 'http://localhost:4000/auth/kakao/callback',
    };
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('buildAuthorizeUrl: scope에 account_email 없이 profile만 포함한다', () => {
    const service = new KakaoOauthService();
    const url = service.buildAuthorizeUrl('state-123');
    expect(url).toContain('https://kauth.kakao.com/oauth/authorize');
    expect(url).toContain('client_id=rest-key');
    expect(url).toContain('state=state-123');
    expect(url).toContain('scope=profile_nickname+profile_image');
    expect(url).not.toContain('account_email');
  });

  it('exchangeCodeForToken: code로 카카오 access_token을 받는다', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'kakao-access' }),
    } as Response);
    const service = new KakaoOauthService();
    const token = await service.exchangeCodeForToken('the-code');
    expect(token).toBe('kakao-access');
  });

  it('getKakaoProfile: kakaoId와 nickname을 추출한다', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 4821,
        kakao_account: { profile: { nickname: '홍길동' } },
      }),
    } as Response);
    const service = new KakaoOauthService();
    const profile = await service.getKakaoProfile('kakao-access');
    expect(profile).toEqual({ kakaoId: '4821', nickname: '홍길동' });
  });

  it('getKakaoProfile: nickname 없으면 카카오사용자 폴백', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 4821, kakao_account: {} }),
    } as Response);
    const service = new KakaoOauthService();
    const profile = await service.getKakaoProfile('kakao-access');
    expect(profile).toEqual({ kakaoId: '4821', nickname: '카카오사용자' });
  });
});
