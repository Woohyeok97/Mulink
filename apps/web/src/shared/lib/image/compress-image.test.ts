import { describe, it, expect } from 'vitest';
import { calcTargetSize } from './compress-image';

describe('calcTargetSize', () => {
  it('긴 변이 상한 초과면 비율 유지하며 축소', () => {
    expect(calcTargetSize(4000, 3000, 800)).toEqual({ width: 800, height: 600 });
  });

  it('세로가 더 길면 세로를 상한에 맞춤', () => {
    expect(calcTargetSize(3000, 6000, 800)).toEqual({ width: 400, height: 800 });
  });

  it('긴 변이 상한 이하면 원본 그대로', () => {
    expect(calcTargetSize(400, 300, 800)).toEqual({ width: 400, height: 300 });
  });

  it('긴 변이 상한과 같으면 원본 그대로', () => {
    expect(calcTargetSize(800, 500, 800)).toEqual({ width: 800, height: 500 });
  });
});
