import { SupabaseAdminService } from './supabase-admin.service';

describe('SupabaseAdminService', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    // createClient가 URL/키 없이 생성 시 throw하므로 더미 env를 채운다.
    // (실제 Supabase 호출은 fakeClient로 대체되므로 값은 무의미)
    process.env = {
      ...ORIGINAL_ENV,
      SUPABASE_URL: 'http://localhost',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    };
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('generateLink의 hashed_token을 verifyOtp의 token_hash로 넘겨 세션을 발급한다', async () => {
    const generateLink = jest.fn().mockResolvedValue({
      data: { properties: { hashed_token: 'hash-xyz' } },
      error: null,
    });
    const verifyOtp = jest.fn().mockResolvedValue({
      data: { session: { access_token: 'AT', refresh_token: 'RT' } },
      error: null,
    });
    const fakeClient: any = { auth: { admin: { generateLink }, verifyOtp } };

    const service = new SupabaseAdminService();
    // 내부 client를 테스트용으로 주입
    (service as any).client = fakeClient;

    const tokens = await service.issueSession({ kakaoId: '4821', nickname: '홍길동' });

    // 합성 이메일로 magiclink 생성
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'magiclink',
        email: '4821@kakao.local',
        options: expect.objectContaining({
          data: { provider: 'kakao', provider_id: '4821', name: '홍길동' },
        }),
      }),
    );
    // 응답 hashed_token → 파라미터 token_hash 매핑 검증 (오타 회귀 방지)
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash-xyz', type: 'magiclink' });
    expect(tokens).toEqual({ accessToken: 'AT', refreshToken: 'RT' });
  });

  it('generateLink 실패 시 에러를 던진다', async () => {
    const fakeClient: any = {
      auth: {
        admin: { generateLink: jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } }) },
        verifyOtp: jest.fn(),
      },
    };
    const service = new SupabaseAdminService();
    (service as any).client = fakeClient;
    await expect(
      service.issueSession({ kakaoId: '1', nickname: 'n' }),
    ).rejects.toThrow();
  });

  it('verifyOtp 실패(세션 없음) 시 에러를 던진다', async () => {
    const fakeClient: any = {
      auth: {
        admin: {
          generateLink: jest.fn().mockResolvedValue({
            data: { properties: { hashed_token: 'hash-xyz' } },
            error: null,
          }),
        },
        verifyOtp: jest
          .fn()
          .mockResolvedValue({ data: { session: null }, error: { message: 'bad otp' } }),
      },
    };
    const service = new SupabaseAdminService();
    (service as any).client = fakeClient;
    await expect(
      service.issueSession({ kakaoId: '1', nickname: 'n' }),
    ).rejects.toThrow();
  });
});
