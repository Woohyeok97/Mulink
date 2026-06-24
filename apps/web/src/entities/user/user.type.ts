// 유저 권한. Prisma schema의 Role enum과 값이 일치해야 함(수동 동기화).
type Role = 'STUDENT' | 'COACH' | 'ADMIN';

// DB User 테이블의 한 행. 백엔드 GET /users/me 응답과 1:1 대응.
// Prisma schema(User)가 원본이므로 필드 추가/변경 시 이 타입도 함께 수정해야 함.
export type User = {
  id: string;
  kakaoId: string;
  nickname: string;
  role: Role;
  createdAt: string; // JSON 직렬화되면서 Date가 ISO 문자열로 전달됨
};
