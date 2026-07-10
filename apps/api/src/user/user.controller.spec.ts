import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  const userService = {
    upsertUser: jest.fn(),
    getMe: jest.fn(),
  } as unknown as UserService;
  const controller = new UserController(userService);
  const reqUser: any = {
    id: 'uuid-1',
    user_metadata: { name: '홍길동' },
    identities: [{ provider: 'kakao', id: '12345' }],
  };

  beforeEach(() => jest.clearAllMocks());

  it('upsertUser: userService.upsertUser에 유저를 넘긴다', async () => {
    (userService.upsertUser as jest.Mock).mockResolvedValue({
      id: 'uuid-1',
      nickname: '홍길동',
    });
    const result = await controller.upsertUser({ user: reqUser } as any);
    expect(userService.upsertUser).toHaveBeenCalledWith(reqUser);
    expect(result).toEqual({ id: 'uuid-1', nickname: '홍길동' });
  });

  it('getMe: userService.getMe에 userId를 넘긴다', async () => {
    (userService.getMe as jest.Mock).mockResolvedValue({
      id: 'uuid-1',
      nickname: '홍길동',
    });
    const result = await controller.getMe({ user: reqUser } as any);
    expect(userService.getMe).toHaveBeenCalledWith('uuid-1');
    expect(result).toEqual({ id: 'uuid-1', nickname: '홍길동' });
  });
});
