import { describe, it, expect } from 'vitest';
import { LessonRequestSchema, REGIONS, GENRES } from './lesson-request.schema';

const validInput = { region: 'SEOUL', genre: 'POP', goal: '음치 탈출' } as const;

describe('LessonRequestSchema', () => {
  it('region, genre, goal이 모두 유효하면 통과한다', () => {
    const result = LessonRequestSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('goal이 빈 문자열이면 레슨 목표 에러를 반환한다', () => {
    const result = LessonRequestSchema.safeParse({ ...validInput, goal: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const goalError = result.error.issues.find((issue) => issue.path[0] === 'goal');
      expect(goalError?.message).toBe('레슨 목표를 입력해 주세요.');
    }
  });

  it('region이 undefined이면 에러를 반환한다', () => {
    const result = LessonRequestSchema.safeParse({ ...validInput, region: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      const regionError = result.error.issues.find((issue) => issue.path[0] === 'region');
      expect(regionError).toBeDefined();
    }
  });

  it('genre가 undefined이면 에러를 반환한다', () => {
    const result = LessonRequestSchema.safeParse({ ...validInput, genre: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      const genreError = result.error.issues.find((issue) => issue.path[0] === 'genre');
      expect(genreError).toBeDefined();
    }
  });

  it('REGIONS의 모든 value가 schema enum으로 유효하다', () => {
    for (const { value } of REGIONS) {
      const result = LessonRequestSchema.safeParse({ ...validInput, region: value });
      expect(result.success).toBe(true);
    }
  });

  it('GENRES의 모든 value가 schema enum으로 유효하다', () => {
    for (const { value } of GENRES) {
      const result = LessonRequestSchema.safeParse({ ...validInput, genre: value });
      expect(result.success).toBe(true);
    }
  });
});
