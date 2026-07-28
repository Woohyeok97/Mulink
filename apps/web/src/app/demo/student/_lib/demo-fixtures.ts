// 학생 체험(데모) 전용 고정 데이터. DB를 타지 않고 화면만 채운다.
// 실제 도메인 타입을 그대로 써서, 스키마가 바뀌면 타입 에러로 드러나게 한다.
import type { ChatMessage } from '@/entities/chat/chat.type';
import type { LessonProposal } from '@/entities/lesson-request/lesson-request.type';
import type { LessonRequestFormType } from '@/features/lesson-request/lesson-request.schema';

// 시드와 같은 S3 코치 이미지(압축 webp). 번호는 seed.ts의 COACH_NAMES 순서를 따른다.
const S3_BASE = 'https://mulink-storage.s3.ap-northeast-2.amazonaws.com/seed_images_compressed';

// 데모 채팅에서 senderId 비교용 — 실제 UUID가 아니어도 화면 분기에는 충분하다
export const DEMO_ME_ID = 'demo-student';
export const DEMO_COACH_ID = 'demo-coach';

// 채팅 상대로 고정되는 코치(제안 목록의 첫 번째와 동일 인물)
export const DEMO_CHAT_PARTNER = {
  name: '박지우 보컬 스튜디오',
  imageUrl: `${S3_BASE}/coach3.webp`
};

// 신청서에 미리 채워두는 값 — 체험자가 그대로 제출하거나 수정할 수 있다
export const DEFAULT_REQUEST_VALUES: LessonRequestFormType = {
  region: 'SEOUL',
  genre: 'BALLAD',
  goal: '음치 탈출하고 노래방에서 자신 있게 부르고 싶어요.'
};

// 신청 직후 도착해 있는 코치 제안 3건
export const DEMO_PROPOSALS: LessonProposal[] = [
  {
    id: 'demo-proposal-1',
    message:
      '안녕하세요! 발라드 위주로 10년째 레슨하고 있어요. 호흡과 발성부터 차근차근 잡아드릴게요. 편하게 연락 주세요.',
    createdAt: minutesAgo(12),
    roomId: 'demo-room',
    coachProfile: {
      activityName: '박지우 보컬 스튜디오',
      imageUrl: `${S3_BASE}/coach3.webp`,
      region: 'SEOUL'
    }
  },
  {
    id: 'demo-proposal-2',
    message: '노래방에서 자신 있게 부르는 게 목표시라면 음정 교정부터 시작하는 걸 추천드려요. 첫 수업은 무료로 진행합니다.',
    createdAt: minutesAgo(48),
    roomId: null,
    coachProfile: {
      activityName: '강태윤 실용음악 레슨',
      imageUrl: `${S3_BASE}/coach6.webp`,
      region: 'SEOUL'
    }
  },
  {
    id: 'demo-proposal-3',
    message: '취미로 시작하시는 분들 많이 가르쳐봤어요. 부담 없이 즐기면서 배우실 수 있게 도와드릴게요!',
    createdAt: minutesAgo(130),
    roomId: null,
    coachProfile: {
      activityName: '윤시우 보컬 트레이닝',
      imageUrl: `${S3_BASE}/coach8.webp`,
      region: 'GYEONGGI'
    }
  }
];

// 채팅방에 이미 쌓여 있는 코치의 첫 인사.
// 이 메시지는 서버에서도 렌더되므로 시각을 고정해야 한다.
// 상대 시각을 쓰면 서버와 브라우저의 계산 시점이 달라 hydration이 깨진다.
export const DEMO_INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    roomId: 'demo-room',
    senderId: DEMO_COACH_ID,
    content: '안녕하세요! 신청서 잘 봤어요. 서울에서 발라드 위주로 수업하고 있습니다.',
    createdAt: '2026-07-28T05:30:00.000Z' // 한국 시간 오후 2:30
  },
  {
    id: 2,
    roomId: 'demo-room',
    senderId: DEMO_COACH_ID,
    content: '궁금한 점 있으시면 편하게 물어보세요!',
    createdAt: '2026-07-28T05:31:00.000Z' // 한국 시간 오후 2:31
  }
];

// 체험자가 메시지를 보낼 때마다 순서대로 하나씩 나가는 답장.
// 마지막 대사는 체험이 끝났음을 알리고, 곧바로 가입 유도 모달로 이어진다.
export const DEMO_REPLIES: string[] = [
  '기초 발성부터 차근차근 잡아드릴 수 있어요. 혹시 레슨 받아보신 경험이 있으실까요?',
  '괜찮아요, 처음 오시는 분들이 대부분이에요. 첫 수업은 목소리 상태를 같이 확인하는 것부터 시작합니다.',
  '평일 저녁이나 주말에 시간 맞춰 진행 가능해요. 편하신 시간대가 있으실까요?',
  '체험은 여기까지예요! 실제 서비스에서는 코치와 자유롭게 대화하며 레슨 일정을 잡을 수 있어요.'
];

// n분 전 시각을 ISO로 — 카드의 '~분 전' 표시가 자연스럽게 나오도록
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}
