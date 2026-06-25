import { z } from 'zod';

export const REGIONS = [
  { value: 'SEOUL', label: '서울' },
  { value: 'GYEONGGI', label: '경기' },
  { value: 'INCHEON', label: '인천' },
] as const;

export type RegionValue = (typeof REGIONS)[number]['value'];

export const coachApplySchema = z.object({
  activityName: z.string().min(1, '활동명을 입력해 주세요.'),
  region: z.enum(['SEOUL', 'GYEONGGI', 'INCHEON'], {
    error: '지역을 선택해 주세요.',
  }),
});

export type CoachApplyFormValues = z.infer<typeof coachApplySchema>;
