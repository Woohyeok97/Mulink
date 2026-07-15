// 유저 권한. Prisma schema의 Role enum과 값이 일치해야 함(수동 동기화).
type Role = 'STUDENT' | 'COACH' | 'ADMIN';

// 코치 활동 지역. Prisma schema의 Region enum과 값이 일치해야 함(수동 동기화).
type Region = 'SEOUL' | 'GYEONGGI' | 'INCHEON';

// 코치 프로필. 코치(role === 'COACH')일 때만 존재한다.
export type CoachProfile = {
  id: string;
  activityName: string;
  imageUrl: string | null;
  region: Region;
};

// DB User 테이블의 한 행. 백엔드 GET /users/me 응답과 1:1 대응.
// Prisma schema(User)가 원본이므로 필드 추가/변경 시 이 타입도 함께 수정해야 함.
export type User = {
  id: string;
  kakaoId: string;
  nickname: string;
  role: Role;
  createdAt: string; // JSON 직렬화되면서 Date가 ISO 문자열로 전달됨
  coachProfile: CoachProfile | null; // 코치면 프로필, 아니면 null
};
