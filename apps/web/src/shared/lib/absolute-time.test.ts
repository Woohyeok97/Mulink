import { describe, it, expect } from 'vitest';
import { toAbsoluteTime } from './absolute-time';

describe('toAbsoluteTime', () => {
  it('로컬 시각을 YYYY.MM.DD HH:mm 형식으로 만든다', () => {
    // 로컬 시간대와 무관하게 검증하려고 Date 인자로 로컬 시각을 직접 지정
    const local = new Date(2026, 6, 6, 9, 5); // 2026-07-06 09:05 (월은 0-based)
    expect(toAbsoluteTime(local.toISOString())).toBe('2026.07.06 09:05');
  });
});
