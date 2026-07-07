import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LessonRequestList } from './LessonRequestList';
import { createLessonProposalAction } from '../lesson-proposal.action';
import type { OpenLessonRequest } from '@/entities/lesson-request/lesson-request.type';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('../lesson-proposal.action', () => ({ createLessonProposalAction: vi.fn() }));

const baseReq: OpenLessonRequest = {
  id: 'req-1',
  studentNickname: '민지',
  region: 'SEOUL',
  goal: '음정 교정하고 싶어요',
  genre: 'POP',
  createdAt: new Date().toISOString(),
  isProposed: false,
};

describe('LessonRequestList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('목록이 비면 빈 상태 문구를 보여준다', () => {
    render(<LessonRequestList requests={[]} />);
    expect(screen.getByText('아직 모집 중인 레슨 신청이 없어요')).toBeInTheDocument();
  });

  it('제안 완료된 신청은 배지를 보여주고 제안 버튼이 없다', () => {
    render(<LessonRequestList requests={[{ ...baseReq, isProposed: true }]} />);
    expect(screen.getByText('제안 완료')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /제안/ })).not.toBeInTheDocument();
  });

  it('제안 버튼을 누르면 폼이 열리고, 빈 메시지 제출은 검증 에러를 낸다', async () => {
    const user = userEvent.setup();
    render(<LessonRequestList requests={[baseReq]} />);

    await user.click(screen.getByRole('button', { name: /제안/ }));
    const textarea = screen.getByPlaceholderText('학생에게 전할 한마디를 적어 주세요.');
    expect(textarea).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '제안 전송' }));
    expect(await screen.findByText('제안 한마디를 입력해 주세요.')).toBeInTheDocument();
    expect(createLessonProposalAction).not.toHaveBeenCalled();
  });

  it('메시지 입력 후 전송하면 액션 호출 + router.refresh()', async () => {
    vi.mocked(createLessonProposalAction).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LessonRequestList requests={[baseReq]} />);

    await user.click(screen.getByRole('button', { name: /제안/ }));
    await user.type(screen.getByPlaceholderText('학생에게 전할 한마디를 적어 주세요.'), '함께 해요');
    await user.click(screen.getByRole('button', { name: '제안 전송' }));

    expect(createLessonProposalAction).toHaveBeenCalledWith('req-1', '함께 해요');
    expect(refresh).toHaveBeenCalled();
  });
});
