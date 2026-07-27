import { describe, it, expect } from 'vitest';
import { mergeMessages } from './merge-messages';
import type { ChatMessage } from '@/entities/chat/chat.type';

const msg = (id: number): ChatMessage => ({
  id,
  roomId: 'r',
  senderId: 's',
  content: `m${id}`,
  createdAt: '2026-01-01',
});

describe('mergeMessages', () => {
  // 같은 id는 한 번만, id 오름차순으로 정렬
  it('중복 id를 제거하고 id 오름차순으로 병합한다', () => {
    const result = mergeMessages([msg(1), msg(2)], [msg(2), msg(3)]);
    expect(result.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  // 빈 유입은 원본 유지
  it('유입이 비면 기존을 그대로 반환한다', () => {
    const result = mergeMessages([msg(1)], []);
    expect(result.map((m) => m.id)).toEqual([1]);
  });
});
