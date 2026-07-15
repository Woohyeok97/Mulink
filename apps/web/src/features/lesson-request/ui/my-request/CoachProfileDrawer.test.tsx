import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CoachProfileDrawer } from './CoachProfileDrawer';
import type { LessonProposal } from '@/entities/lesson-request/lesson-request.type';

const offer: LessonProposal = {
  id: 'offer-1',
  message: '안녕하세요',
  createdAt: new Date().toISOString(),
  coachProfile: {
    activityName: '홍길동',
    imageUrl: null,
    region: 'SEOUL'
  }
};

describe('CoachProfileDrawer', () => {
  it('카톡 1:1 상담 버튼은 있고 수락 버튼은 없다', () => {
    render(<CoachProfileDrawer offer={offer} onClose={() => {}} />);

    expect(screen.getByRole('button', { name: '카톡 1:1 상담' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '이 코치 수락하기' })).not.toBeInTheDocument();
  });
});
