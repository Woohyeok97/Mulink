import { z } from 'zod';

export const REGIONS = [
  { value: 'SEOUL', label: '서울' },
  { value: 'GYEONGGI', label: '경기' },
  { value: 'INCHEON', label: '인천' },
] as const;

export type RegionValue = (typeof REGIONS)[number]['value'];

const regionValues = REGIONS.map((region) => region.value) as [RegionValue, ...RegionValue[]];

// 코치 신청 폼 스키마
export const CoachRegisterSchema = z.object({
  activityName: z.string().min(1, '활동명을 입력해 주세요.'),
  region: z.enum(regionValues, {
    error: '지역을 선택해 주세요.',
  }),
  imageUrl: z.string().optional(), // 프로필 이미지 S3 공개 URL (선택)
});

// 코치 신청 폼 타입
export type CoachRegisterFormType = z.infer<typeof CoachRegisterSchema>;
