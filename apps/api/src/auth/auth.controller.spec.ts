import { NotFoundException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const prisma = { user: { upsert: jest.fn(), findUnique: jest.fn() } };
  const controller = new AuthController(prisma as any);
  const reqUser: any = {
    id: 'uuid-1',
    user_metadata: { name: '홍길동' },
    identities: [{ provider: 'kakao', id: '12345' }],
  };

  beforeEach(() => jest.clearAllMocks());

  it('sync: 토큰 유저로 User를 upsert 한다', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'uuid-1', nickname: '홍길동' });
    const result = await controller.sync({ user: reqUser } as any);
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: 'uuid-1' },
      create: { id: 'uuid-1', kakaoId: '12345', nickname: '홍길동' },
      update: {},
    });
    expect(result).toEqual({ id: 'uuid-1', nickname: '홍길동' });
  });

  it('me: DB의 User를 반환한다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', nickname: '홍길동' });
    await expect(controller.me({ user: reqUser } as any)).resolves.toEqual({
      id: 'uuid-1',
      nickname: '홍길동',
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
  });

  it('me: User가 없으면 404', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(controller.me({ user: reqUser } as any)).rejects.toThrow(NotFoundException);
  });
});
