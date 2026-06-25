import { describe, it, expect } from 'vitest';
import { coachApplySchema, REGIONS } from './coachApplySchema';

describe('coachApplySchema', () => {
  it('activityName이 빈 문자열이면 활동명 에러를 반환한다', () => {
    const result = coachApplySchema.safeParse({ activityName: '', region: 'SEOUL' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const activityNameError = result.error.issues.find(
        issue => issue.path[0] === 'activityName',
      );
      expect(activityNameError?.message).toBe('활동명을 입력해 주세요.');
    }
  });

  it('activityName이 있고 region이 유효한 값이면 통과한다', () => {
    const result = coachApplySchema.safeParse({ activityName: '보컬 코치', region: 'SEOUL' });
    expect(result.success).toBe(true);
  });

  it('region이 유효하지 않은 값이면 에러를 반환한다', () => {
    const result = coachApplySchema.safeParse({ activityName: '보컬 코치', region: 'BUSAN' });
    expect(result.success).toBe(false);
  });

  it('region이 undefined이면 에러를 반환한다', () => {
    // zod v4에서는 required_error 옵션이 지원되지 않아 invalid_value 에러로 처리됨
    const result = coachApplySchema.safeParse({ activityName: '보컬 코치', region: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      const regionError = result.error.issues.find(issue => issue.path[0] === 'region');
      expect(regionError).toBeDefined();
    }
  });

  it('REGIONS 배열이 3개 항목을 올바른 순서로 포함한다', () => {
    expect(REGIONS).toHaveLength(3);
    expect(REGIONS[0].value).toBe('SEOUL');
    expect(REGIONS[1].value).toBe('GYEONGGI');
    expect(REGIONS[2].value).toBe('INCHEON');
    expect(REGIONS[0].label).toBe('서울');
    expect(REGIONS[1].label).toBe('경기');
    expect(REGIONS[2].label).toBe('인천');
  });
});
