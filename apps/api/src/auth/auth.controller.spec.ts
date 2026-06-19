import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const authService = {
    sync: jest.fn(),
    me: jest.fn(),
  } as unknown as AuthService;
  const controller = new AuthController(authService);
  const reqUser: any = {
    id: 'uuid-1',
    user_metadata: { name: '홍길동' },
    identities: [{ provider: 'kakao', id: '12345' }],
  };

  beforeEach(() => jest.clearAllMocks());

  it('sync: authService.sync에 유저를 넘긴다', async () => {
    (authService.sync as jest.Mock).mockResolvedValue({
      id: 'uuid-1',
      nickname: '홍길동',
    });
    const result = await controller.sync({ user: reqUser } as any);
    expect(authService.sync).toHaveBeenCalledWith(reqUser);
    expect(result).toEqual({ id: 'uuid-1', nickname: '홍길동' });
  });

  it('me: authService.me에 userId를 넘긴다', async () => {
    (authService.me as jest.Mock).mockResolvedValue({
      id: 'uuid-1',
      nickname: '홍길동',
    });
    const result = await controller.me({ user: reqUser } as any);
    expect(authService.me).toHaveBeenCalledWith('uuid-1');
    expect(result).toEqual({ id: 'uuid-1', nickname: '홍길동' });
  });
});
