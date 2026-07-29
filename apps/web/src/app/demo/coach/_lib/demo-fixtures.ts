// 코치 체험(데모) 전용 고정 데이터. DB를 타지 않고 화면만 채운다.
// 실제 도메인 타입을 그대로 써서, 스키마가 바뀌면 타입 에러로 드러나게 한다.
import type { ChatMessage } from '@/entities/chat/chat.type';
import type { OpenLessonRequest } from '@/entities/lesson-request/lesson-request.type';
import type { CoachRegisterFormType } from '@/features/coach-register/coach-register.schema';
import { DEMO_PARTNER_ID, DEMO_S3_BASE } from '../../_lib/demo-ids';

// 가입 폼에 미리 채워두는 값 — 체험자가 그대로 제출하거나 수정할 수 있다
export const DEFAULT_COACH_VALUES: CoachRegisterFormType = {
  activityName: '해온 보컬 스튜디오',
  region: 'SEOUL',
  imageUrl: undefined
};

// 채팅 상대로 고정되는 학생(목록 첫 번째 신청자와 동일 인물)
export const DEMO_CHAT_PARTNER = {
  name: '나윤',
  imageUrl: `${DEMO_S3_BASE}/coach5.webp`
};

// 코치가 보는 모집중 레슨 신청 목록.
// 시각은 서버에서도 렌더되므로 고정해야 한다(상대 시각을 쓰면 hydration이 깨진다).
export const DEMO_OPEN_REQUESTS: OpenLessonRequest[] = [
  {
    id: 'demo-request-1',
    studentNickname: '나윤',
    region: 'SEOUL',
    goal: '음치 탈출하고 노래방에서 자신 있게 부르고 싶어요.',
    genre: 'BALLAD',
    createdAt: '2026-07-28T05:10:00.000Z',
    myProposal: null
  },
  {
    id: 'demo-request-2',
    studentNickname: '준서',
    region: 'SEOUL',
    goal: '실용음악과 입시를 준비하고 있어요. 발성 교정이 필요합니다.',
    genre: 'POP',
    createdAt: '2026-07-28T03:40:00.000Z',
    myProposal: null
  },
  {
    id: 'demo-request-3',
    studentNickname: '서아',
    region: 'GYEONGGI',
    goal: '취미로 시작하려고 해요. 기초부터 천천히 배우고 싶어요.',
    genre: 'RNB',
    createdAt: '2026-07-27T23:20:00.000Z',
    myProposal: null
  },
  {
    id: 'demo-request-4',
    studentNickname: '도윤',
    region: 'INCHEON',
    goal: '밴드에서 보컬을 맡게 됐는데 고음이 잘 안 나와요.',
    genre: 'ROCK',
    createdAt: '2026-07-27T12:00:00.000Z',
    myProposal: null
  }
];

// 채팅방에 이미 쌓여 있는 학생의 첫 인사.
// 초기 메시지도 서버에서 렌더되므로 시각을 고정한다.
export const DEMO_INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    roomId: 'demo-room',
    senderId: DEMO_PARTNER_ID,
    content: '안녕하세요! 보내주신 제안 잘 봤어요. 상담 좀 받아보고 싶어서 연락드렸습니다.',
    createdAt: '2026-07-28T05:30:00.000Z' // 한국 시간 오후 2:30
  },
  {
    id: 2,
    roomId: 'demo-room',
    senderId: DEMO_PARTNER_ID,
    content: '제가 완전 초보인데 괜찮을까요?',
    createdAt: '2026-07-28T05:31:00.000Z' // 한국 시간 오후 2:31
  }
];

// 코치가 메시지를 보낼 때마다 순서대로 하나씩 나가는 학생의 답장.
// 마지막 대사는 체험이 끝났음을 알리고, 곧바로 가입 유도 모달로 이어진다.
export const DEMO_REPLIES: string[] = [
  '감사합니다! 그럼 주로 어떤 걸 배우게 되나요?',
  '좋아요. 저는 평일 저녁이 편한데 그때 가능하실까요?',
  '체험은 여기까지예요! 실제 서비스에서는 학생과 자유롭게 대화하며 레슨 일정을 잡을 수 있어요.'
];
