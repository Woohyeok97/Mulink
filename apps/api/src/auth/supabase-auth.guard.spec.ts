import { UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

function makeContext(headers: Record<string, string>) {
  const req: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

describe('SupabaseAuthGuard', () => {
  it('Authorization 헤더가 없으면 401', async () => {
    const guard = new SupabaseAuthGuard({ getUser: jest.fn() } as any);
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(UnauthorizedException);
  });

  it('토큰이 유효하지 않으면 401', async () => {
    const supabase = {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad' } }),
    };
    const guard = new SupabaseAuthGuard(supabase as any);
    await expect(
      guard.canActivate(makeContext({ authorization: 'Bearer bad' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('유효한 토큰이면 통과하고 request.user에 유저를 첨부한다', async () => {
    const user = { id: 'uuid-1' };
    const supabase = {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    };
    const guard = new SupabaseAuthGuard(supabase as any);
    const ctx = makeContext({ authorization: 'Bearer good' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().user).toBe(user);
  });
});
