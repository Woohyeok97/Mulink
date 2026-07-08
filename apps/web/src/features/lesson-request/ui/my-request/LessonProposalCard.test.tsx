import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LessonProposalCard } from './LessonProposalCard';
import type { LessonProposal } from '@/entities/lesson-request/lesson-request.type';

const offer: LessonProposal = {
  id: 'offer-1',
  message: '안녕하세요',
  createdAt: new Date().toISOString(),
  coachProfile: {
    activityName: '홍길동',
    region: 'SEOUL'
  }
};

describe('LessonProposalCard', () => {
  it('프로필 보기 버튼 클릭 시 onViewProfile이 호출된다', async () => {
    const user = userEvent.setup();
    const handleViewProfile = vi.fn();

    render(<LessonProposalCard offer={offer} onViewProfile={handleViewProfile} />);

    await user.click(screen.getByRole('button', { name: '프로필 보기' }));

    expect(handleViewProfile).toHaveBeenCalledWith(offer);
  });
});
