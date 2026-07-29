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
  proposals: LessonProposal[];
};

// 코치가 자신이 보낸 제안 한 건. GET /lesson-requests 응답의 myProposal에 대응.
// (학생이 보는 LessonProposal과 달리 coachProfile 없이 내 제안 최소 정보만)
export type MyProposal = {
  id: string;
  message: string;
  createdAt: string;
};

// 코치가 보는 모집중 레슨 신청 한 건. 백엔드 GET /lesson-requests 응답과 1:1 대응.
// (내 신청 조회와 달리 studentId 대신 studentNickname과 myProposal이 붙는다)
export type OpenLessonRequest = {
  id: string;
  studentNickname: string;
  region: Region;
  goal: string;
  genre: Genre;
  createdAt: string; // JSON 직렬화되면서 Date가 ISO 문자열로 전달됨
  myProposal: MyProposal | null; // 이미 보낸 제안(없으면 null)
};

// 코치 제안 1건. 백엔드 GET /lesson-requests/me 응답의 proposals 항목과 1:1 대응.
export type LessonProposal = {
  id: string;
  message: string;
  createdAt: string;
  roomId: string | null; // 이 코치와의 채팅방 있으면 그 id, 없으면 null
  coachProfile: {
    activityName: string;
    imageUrl: string | null;
    region: Region;
  };
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
