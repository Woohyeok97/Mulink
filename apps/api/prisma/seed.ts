// ⚠️ 개발 전용 시드 스크립트. 프로덕션 배포 전 제거 대상.
// docs/superpowers/plans/2026-07-03-dev-seed-and-dev-login.md 참고.
//
// 하는 일: 가짜 코치 12·학생 12를 auth.users + public.User 양쪽에 만들고,
// 학생 신청 12개 + 각 신청마다 코치 6명의 제안을 깐다.
// 재실행하면 0단계 청소로 기존 dev-seed 데이터를 리셋한 뒤 다시 만든다.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
// Prisma 7은 클라이언트를 generated/prisma에 생성한다 (PrismaService와 동일 경로)
import { PrismaClient, Region, Genre } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// env는 prisma.config.ts가 `import 'dotenv/config'`로 로드해 채워준다

// dev-seed 유저를 골라내는 표식 — 청소·dev 로그인 목록 조회의 기준
const SEED_PREFIX = 'dev-seed';
const emailOf = (kakaoId: string) => `${kakaoId}@kakao.local`;

const COACH_COUNT = 12;
const STUDENT_COUNT = 12;
const PROPOSALS_PER_REQUEST = 12; // 각 학생 신청에 붙는 코치 수 (전원 제안 — 이미지 목록 LCP 측정용)

const REGIONS = Object.values(Region);
const GENRES = Object.values(Genre);

// 자연스러운 더미 값 풀 (코치/학생 각 12명이므로 12개 이상)
const COACH_NAMES = [
  '김서연',
  '이도현',
  '박지우',
  '최민준',
  '정하은',
  '강태윤',
  '조예린',
  '윤시우',
  '임수아',
  '한지호',
  '오다인',
  '서준혁',
];
const STUDENT_NAMES = [
  '나윤',
  '준서',
  '지민',
  '하린',
  '유찬',
  '서아',
  '민재',
  'soyeon',
  '건우',
  '채원',
  '도윤',
  '은우',
];
// 코치 프로필 이미지 (S3 seed_images_compressed/, canvas API로 최적화된 webp — LCP 측정용). COACH_NAMES 순서와 1:1 대응.
const S3_BASE =
  'https://mulink-storage.s3.ap-northeast-2.amazonaws.com/seed_images_compressed';
const COACH_IMAGE_URLS = Array.from(
  { length: COACH_COUNT },
  (_, i) => `${S3_BASE}/coach${i + 1}.webp`,
);

// 코치 활동명 스타일 (이름과 조합)
const STUDIO_SUFFIXES = [
  '보컬 스튜디오',
  '실용음악 레슨',
  '보컬 트레이닝',
  '노래 클래스',
  '뮤직 아카데미',
  '보컬 코칭',
];
// 학생 레슨 목적
const GOALS = [
  '취미로 노래 실력을 늘리고 싶어요. 기초 발성부터 차근차근 배우고 싶습니다.',
  '오디션 준비 중이에요. 고음이 불안정해서 안정적으로 내는 법을 배우고 싶어요.',
  '회사 노래방에서 자신감 있게 부르고 싶어요. 음정이 자주 흔들려서 고민이에요.',
  '버스킹을 목표로 하고 있어요. 감정 표현과 무대 매너까지 함께 배우고 싶습니다.',
  '발라드를 감성적으로 부르고 싶은데 호흡이 짧아서 어려워요.',
  '유튜브에 커버 영상을 올리려고 준비 중입니다. 톤 잡는 법을 배우고 싶어요.',
  '실용음악과 입시를 준비하고 있어요. 체계적인 커리큘럼이 필요합니다.',
  '음역대가 좁아서 부를 수 있는 곡이 한정적이에요. 음역을 넓히고 싶어요.',
  '노래는 좋아하는데 박자 감각이 부족해요. 리듬감을 키우고 싶습니다.',
  '결혼식 축가를 준비하고 있어요. 한 곡을 완성도 있게 부르고 싶어요.',
  '평소 목이 금방 쉬어요. 목에 무리 없는 발성을 배우고 싶습니다.',
  '밴드 보컬을 맡게 됐는데 성량이 부족해서 고민이에요.',
];
// 코치 제안 한마디
const MESSAGES = [
  '안녕하세요! 기초 발성부터 탄탄하게 잡아드릴게요. 편하게 시작해봐요.',
  '고음 안정화는 제 전문 분야예요. 3개월이면 확실한 변화 느끼실 거예요.',
  '음정 교정 위주로 커리큘럼 짜서 진행해드릴 수 있어요. 함께 해봐요!',
  '무대 경험이 많아서 실전 팁까지 알려드릴 수 있어요. 연락 주세요.',
  '호흡 트레이닝부터 감정 표현까지, 발라드 전문으로 지도합니다.',
  '수강생 톤에 맞는 곡 추천도 함께 해드려요. 부담 없이 문의 주세요.',
  '입시 지도 경력이 있어서 체계적으로 준비 도와드릴 수 있습니다.',
  '음역 확장 훈련법을 단계별로 알려드릴게요. 금방 늘어요!',
  '리듬 트레이닝 프로그램이 따로 있어요. 박자 감각 확실히 잡아드립니다.',
  '한 곡 완성 레슨 많이 진행해봤어요. 축가 완벽하게 준비해드릴게요.',
  '성대에 무리 없는 발성이 제 강점이에요. 오래 노래하실 수 있게 도와드려요.',
  '밴드 보컬 지도 경험 많습니다. 성량과 표현력 같이 키워봐요.',
];

// 배열에서 랜덤 하나
const sample = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as any },
  },
);

// 배열에서 count개를 무작위로 뽑는다 (신청마다 다른 코치 6명 배정용)
function pickRandom<T>(arr: T[], count: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, count);
}

// auth.users에 유저를 만들고 그 id로 public.User를 만든다 (id는 auth.users.id와 동일)
async function createSeedUser(
  supabase: SupabaseClient,
  kakaoId: string,
  nickname: string,
) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: emailOf(kakaoId),
    email_confirm: true,
    // extractKakaoProfile이 provider_id/name을 읽으므로 동일 형식으로 심는다
    user_metadata: { provider: 'kakao', provider_id: kakaoId, name: nickname },
  });
  if (error || !data.user) {
    throw new Error(`auth.users 생성 실패 (${kakaoId}): ${error?.message}`);
  }
  return data.user.id;
}

// 0단계: 기존 dev-seed 데이터 청소 (재실행 안전성)
async function clean() {
  // public.User 삭제 → cascade로 CoachProfile/LessonRequest/LessonProposal 자동 삭제
  await prisma.user.deleteMany({
    where: { kakaoId: { startsWith: `${SEED_PREFIX}-` } },
  });

  // auth.users는 cascade 대상이 아니므로 직접 삭제 (페이지네이션 순회)
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`auth.users 조회 실패: ${error.message}`);
    const seedUsers = data.users.filter((u) =>
      u.email?.startsWith(`${SEED_PREFIX}-`),
    );
    for (const u of seedUsers) {
      await supabase.auth.admin.deleteUser(u.id);
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  console.log('✔ 0단계: 기존 dev-seed 데이터 청소 완료');
}

async function main() {
  await clean();

  // 1단계: 코치 12명 (auth.users + public.User(COACH) + CoachProfile)
  const coachIds: string[] = [];
  for (let i = 1; i <= COACH_COUNT; i++) {
    const kakaoId = `${SEED_PREFIX}-coach${i}`;
    const nickname = COACH_NAMES[i - 1];
    const id = await createSeedUser(supabase, kakaoId, nickname);
    await prisma.user.create({
      data: {
        id,
        kakaoId,
        nickname,
        role: 'COACH',
        coachProfile: {
          create: {
            activityName: `${nickname} ${STUDIO_SUFFIXES[i % STUDIO_SUFFIXES.length]}`,
            imageUrl: COACH_IMAGE_URLS[i - 1],
            region: REGIONS[i % REGIONS.length],
          },
        },
      },
    });
    coachIds.push(id);
  }
  console.log(`✔ 1단계: 코치 ${COACH_COUNT}명 생성`);

  // 2단계: 학생 12명 (auth.users + public.User(STUDENT))
  const studentIds: string[] = [];
  for (let i = 1; i <= STUDENT_COUNT; i++) {
    const kakaoId = `${SEED_PREFIX}-student${i}`;
    const nickname = STUDENT_NAMES[i - 1];
    const id = await createSeedUser(supabase, kakaoId, nickname);
    await prisma.user.create({
      data: { id, kakaoId, nickname, role: 'STUDENT' },
    });
    studentIds.push(id);
  }
  console.log(`✔ 2단계: 학생 ${STUDENT_COUNT}명 생성`);

  // 3단계: 학생마다 레슨 신청 1개 (studentId unique)
  const requestIds: string[] = [];
  for (let i = 0; i < studentIds.length; i++) {
    const req = await prisma.lessonRequest.create({
      data: {
        studentId: studentIds[i],
        region: REGIONS[i % REGIONS.length],
        goal: GOALS[i % GOALS.length],
        genre: GENRES[i % GENRES.length],
      },
    });
    requestIds.push(req.id);
  }
  console.log(`✔ 3단계: 레슨 신청 ${requestIds.length}개 생성`);

  // 4단계: 각 신청에 서로 다른 코치 6명이 제안 (@@unique([requestId, coachId]) 준수)
  let proposalCount = 0;
  for (const requestId of requestIds) {
    const chosen = pickRandom(coachIds, PROPOSALS_PER_REQUEST);
    for (const coachId of chosen) {
      await prisma.lessonProposal.create({
        data: {
          requestId,
          coachId,
          message: sample(MESSAGES),
        },
      });
      proposalCount++;
    }
  }
  console.log(
    `✔ 4단계: 레슨 제안 ${proposalCount}개 생성 (신청당 ${PROPOSALS_PER_REQUEST}명)`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('🌱 시드 완료');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
