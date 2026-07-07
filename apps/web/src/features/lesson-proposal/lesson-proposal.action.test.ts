import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/shared/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

global.fetch = vi.fn();

import { createLessonProposalAction } from './lesson-proposal.action';
import { createClient } from '@/shared/lib/supabase/server';

// access_token 세션을 돌려주는 supabase mock
function mockSession(token: string | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: token ? { access_token: token } : null } }),
    },
  } as never);
}

describe('createLessonProposalAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('세션 없으면 로그인 필요 에러를 반환한다', async () => {
    mockSession(null);

    const result = await createLessonProposalAction('req-1', '안녕하세요');

    expect(result).toEqual({ error: '로그인이 필요합니다.' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('성공 시 requestId 경로로 POST하고 에러 없이 반환한다', async () => {
    mockSession('test-token');
    vi.mocked(fetch).mockResolvedValue({ ok: true } as never);

    const result = await createLessonProposalAction('req-1', '안녕하세요');

    expect(result).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/lesson-requests/req-1/lesson-proposals'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: '안녕하세요' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('fetch 실패 시 body의 message를 에러로 반환한다', async () => {
    mockSession('test-token');
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: '이미 제안한 레슨 신청입니다.' }),
    } as never);

    const result = await createLessonProposalAction('req-1', '안녕하세요');

    expect(result).toEqual({ error: '이미 제안한 레슨 신청입니다.' });
  });

  it('실패하고 message 없으면 기본 에러 메시지를 반환한다', async () => {
    mockSession('test-token');
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({}),
    } as never);

    const result = await createLessonProposalAction('req-1', '안녕하세요');

    expect(result).toEqual({ error: '제안 전송에 실패했습니다.' });
  });
});
