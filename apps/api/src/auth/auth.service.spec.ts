import { NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = { user: { upsert: jest.fn(), findUnique: jest.fn() } };
  const service = new AuthService(prisma as any);
  const supabaseUser: any = {
    id: 'uuid-1',
    user_metadata: { name: '홍길동' },
    identities: [{ provider: 'kakao', id: '12345' }],
  };

  beforeEach(() => jest.clearAllMocks());

  it('sync: 토큰 유저로 User를 upsert 한다', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'uuid-1', nickname: '홍길동' });
    const result = await service.sync(supabaseUser);
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: 'uuid-1' },
      create: { id: 'uuid-1', kakaoId: '12345', nickname: '홍길동' },
      update: {},
    });
    expect(result).toEqual({ id: 'uuid-1', nickname: '홍길동' });
  });

  it('me: DB의 User를 반환한다', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'uuid-1',
      nickname: '홍길동',
    });
    const result = await service.me('uuid-1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'uuid-1' },
    });
    expect(result).toEqual({ id: 'uuid-1', nickname: '홍길동' });
  });

  it('me: User가 없으면 404', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.me('uuid-1')).rejects.toThrow(NotFoundException);
  });
});
