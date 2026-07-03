// 레슨 희망/코치 활동 지역. Prisma schema의 Region enum과 값이 일치해야 함(수동 동기화).
export type Region =
  | 'SEOUL'
  | 'GYEONGGI'
  | 'INCHEON'
  | 'BUSAN'
  | 'DAEGU'
  | 'ULSAN'
  | 'GWANGJU'
  | 'DAEJEON';

// 선호 장르. Prisma schema의 Genre enum과 값이 일치해야 함(수동 동기화).
export type Genre = 'POP' | 'BALLAD' | 'ROCK' | 'RNB' | 'JAZZ' | 'HIPHOP' | 'TROT';

// DB LessonRequest 테이블의 한 행. 백엔드 GET /lesson-requests/me 응답과 1:1 대응.
// Prisma schema(LessonRequest)가 원본이므로 필드 추가/변경 시 이 타입도 함께 수정해야 함.
export type LessonRequest = {
  id: string;
  studentId: string;
  region: Region;
  goal: string;
  genre: Genre;
  createdAt: string; // JSON 직렬화되면서 Date가 ISO 문자열로 전달됨
};

// 코치 제안 1건. lesson-proposal 기능 구현 시 백엔드 응답과 매핑 예정 (현재 UI에서만 사용).
export type LessonOffer = {
  id: string;
  coach: {
    id: string;
    activityName: string;
    region: Region;
    career: number;
  };
  message: string;
  createdAt: string;
};

export const REGION_LABEL: Record<Region, string> = {
  SEOUL: '서울',
  GYEONGGI: '경기',
  INCHEON: '인천',
  BUSAN: '부산',
  DAEGU: '대구',
  ULSAN: '울산',
  GWANGJU: '광주',
  DAEJEON: '대전',
};

export const GENRE_LABEL: Record<Genre, string> = {
  POP: '팝',
  BALLAD: '발라드',
  ROCK: '록',
  RNB: 'R&B',
  JAZZ: '재즈',
  HIPHOP: '힙합',
  TROT: '트로트',
};
