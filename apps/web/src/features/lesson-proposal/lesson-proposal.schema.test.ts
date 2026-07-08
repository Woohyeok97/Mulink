import { describe, it, expect } from 'vitest';
import { LessonProposalSchema } from './lesson-proposal.schema';

describe('LessonProposalSchema', () => {
  it('message가 있으면 통과한다', () => {
    const result = LessonProposalSchema.safeParse({ message: '안녕하세요, 함께 해요' });
    expect(result.success).toBe(true);
  });

  it('공백만이면 실패한다', () => {
    const result = LessonProposalSchema.safeParse({ message: '   ' });
    expect(result.success).toBe(false);
  });

  it('빈 문자열이면 실패한다', () => {
    const result = LessonProposalSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });
});
