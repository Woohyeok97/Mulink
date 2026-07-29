import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/shared/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

global.fetch = vi.fn();

import { createLessonRequestAction } from './lesson-request.action';
import { createClient } from '@/shared/lib/supabase/server';

const mockFormData = { region: 'SEOUL', genre: 'POP', goal: '음치 탈출' } as const;

describe('createLessonRequestAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('세션 없으면 로그인 필요 에러를 반환한다', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
    } as never);

    const result = await createLessonRequestAction(mockFormData);

    expect(result).toEqual({ error: '로그인이 필요합니다.' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetch 실패 시 body의 message를 에러로 반환한다', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'test-token' } },
        }),
      },
    } as never);
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: '이미 레슨 신청 내역이 있습니다.' }),
    } as never);

    const result = await createLessonRequestAction(mockFormData);

    expect(result).toEqual({ error: '이미 레슨 신청 내역이 있습니다.' });
  });

  it('fetch 실패하고 body에 message 없으면 기본 에러 메시지를 반환한다', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'test-token' } },
        }),
      },
    } as never);
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({}),
    } as never);

    const result = await createLessonRequestAction(mockFormData);

    expect(result).toEqual({ error: '레슨 신청에 실패했습니다.' });
  });

  it('fetch 성공 시 에러 없이(undefined) 반환한다', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'test-token' } },
        }),
      },
    } as never);
    vi.mocked(fetch).mockResolvedValue({ ok: true } as never);

    const result = await createLessonRequestAction(mockFormData);

    expect(result).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/lesson-requests'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
