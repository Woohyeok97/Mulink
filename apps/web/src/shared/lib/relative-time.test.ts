import { describe, it, expect, vi, afterEach } from 'vitest';
import { toRelativeTime } from './relative-time';

const NOW = new Date('2026-07-07T12:00:00.000Z').getTime();

afterEach(() => {
  vi.useRealTimers();
});

function isoMinutesAgo(min: number) {
  return new Date(NOW - min * 60000).toISOString();
}

describe('toRelativeTime', () => {
  it('1분 미만이면 "방금 전"', () => {
    vi.setSystemTime(NOW);
    expect(toRelativeTime(isoMinutesAgo(0))).toBe('방금 전');
  });

  it('분 단위', () => {
    vi.setSystemTime(NOW);
    expect(toRelativeTime(isoMinutesAgo(5))).toBe('5분 전');
  });

  it('시간 단위', () => {
    vi.setSystemTime(NOW);
    expect(toRelativeTime(isoMinutesAgo(3 * 60))).toBe('3시간 전');
  });

  it('일 단위', () => {
    vi.setSystemTime(NOW);
    expect(toRelativeTime(isoMinutesAgo(2 * 24 * 60))).toBe('2일 전');
  });
});
