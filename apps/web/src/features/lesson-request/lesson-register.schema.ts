import { z } from 'zod';

export const REGIONS = [
  { value: 'SEOUL', label: '서울' },
  { value: 'GYEONGGI', label: '경기' },
  { value: 'INCHEON', label: '인천' },
  { value: 'BUSAN', label: '부산' },
  { value: 'DAEGU', label: '대구' },
  { value: 'ULSAN', label: '울산' },
  { value: 'GWANGJU', label: '광주' },
  { value: 'DAEJEON', label: '대전' },
] as const;

export type RegionValue = (typeof REGIONS)[number]['value'];

const regionValues = REGIONS.map((region) => region.value) as [RegionValue, ...RegionValue[]];

export const GENRES = [
  { value: 'POP', label: '팝' },
  { value: 'BALLAD', label: '발라드' },
  { value: 'ROCK', label: '록' },
  { value: 'RNB', label: 'R&B' },
  { value: 'JAZZ', label: '재즈' },
  { value: 'HIPHOP', label: '힙합' },
  { value: 'TROT', label: '트로트' },
] as const;

export type GenreValue = (typeof GENRES)[number]['value'];

const genreValues = GENRES.map((genre) => genre.value) as [GenreValue, ...GenreValue[]];

// 레슨 신청 폼 스키마
export const LessonRegisterSchema = z.object({
  region: z.enum(regionValues, {
    error: '지역을 선택해 주세요.',
  }),
  genre: z.enum(genreValues, {
    error: '선호 장르를 선택해 주세요.',
  }),
  goal: z.string().min(1, '레슨 목표를 입력해 주세요.'),
});

// 레슨 신청 폼 타입
export type LessonRegisterFormType = z.infer<typeof LessonRegisterSchema>;
