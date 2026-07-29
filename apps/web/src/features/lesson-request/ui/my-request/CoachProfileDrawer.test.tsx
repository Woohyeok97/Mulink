import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CoachProfileDrawer } from './CoachProfileDrawer';
import type { LessonProposal } from '@/entities/lesson-request/lesson-request.type';

// 컴포넌트가 useRouter·서버액션을 쓰므로 목으로 대체
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/features/chat/chat.action', () => ({
  createChatRoomAction: vi.fn(),
}));

const baseOffer: LessonProposal = {
  id: 'offer-1',
  message: '안녕하세요',
  createdAt: new Date().toISOString(),
  roomId: null,
  coachProfile: {
    activityName: '홍길동',
    imageUrl: null,
    region: 'SEOUL',
  },
};

describe('CoachProfileDrawer', () => {
  it('방이 없으면 "채팅하기" 버튼을 보여준다', () => {
    render(<CoachProfileDrawer offer={baseOffer} onClose={() => {}} />);

    expect(screen.getByRole('button', { name: '채팅하기' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '이 코치 수락하기' }),
    ).not.toBeInTheDocument();
  });

  it('방이 이미 있으면 "채팅 계속하기" 버튼을 보여준다', () => {
    render(
      <CoachProfileDrawer
        offer={{ ...baseOffer, roomId: 'room-1' }}
        onClose={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: '채팅 계속하기' }),
    ).toBeInTheDocument();
  });
});
