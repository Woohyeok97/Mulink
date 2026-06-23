import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const authService = {
    upsertUser: jest.fn(),
    getMe: jest.fn(),
  } as unknown as AuthService;
  const controller = new AuthController(authService);
  const reqUser: any = {
    id: 'uuid-1',
    user_metadata: { name: '홍길동' },
    identities: [{ provider: 'kakao', id: '12345' }],
  };

  beforeEach(() => jest.clearAllMocks());

  it('upsertUser: authService.upsertUser에 유저를 넘긴다', async () => {
    (authService.upsertUser as jest.Mock).mockResolvedValue({
      id: 'uuid-1',
      nickname: '홍길동',
    });
    const result = await controller.upsertUser({ user: reqUser } as any);
    expect(authService.upsertUser).toHaveBeenCalledWith(reqUser);
    expect(result).toEqual({ id: 'uuid-1', nickname: '홍길동' });
  });

  it('getMe: authService.getMe에 userId를 넘긴다', async () => {
    (authService.getMe as jest.Mock).mockResolvedValue({
      id: 'uuid-1',
      nickname: '홍길동',
    });
    const result = await controller.getMe({ user: reqUser } as any);
    expect(authService.getMe).toHaveBeenCalledWith('uuid-1');
    expect(result).toEqual({ id: 'uuid-1', nickname: '홍길동' });
  });
});
