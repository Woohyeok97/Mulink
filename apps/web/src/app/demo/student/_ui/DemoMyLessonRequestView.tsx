'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
// components
import { Badge } from '@/shared/ui/badge/badge';
import { LessonRequestCard } from '@/features/lesson-request/ui/my-request/LessonRequestCard';
import { DeleteLessonDialog } from '@/features/lesson-request/ui/my-request/DeleteLessonDialog';
import { LessonProposalCard } from '@/features/lesson-request/ui/my-request/LessonProposalCard';
import { DemoCoachProfileDrawer } from './DemoCoachProfileDrawer';
// types
import { type LessonProposal, type LessonRequest } from '@/entities/lesson-request/lesson-request.type';
// demo
import { DEFAULT_REQUEST_VALUES, DEMO_PROPOSALS } from '../_lib/demo-fixtures';
import { parseDemoRequest, readDemoRequestRaw } from '../_lib/demo-storage';

// 프로덕션 MyLessonRequestView의 데모판.
// 신청 내용은 앞 화면에서 sessionStorage에 넣어둔 값을 읽고, 제안은 고정 데이터를 쓴다.
export function DemoMyLessonRequestView() {
  const router = useRouter();
  // sessionStorage는 브라우저에만 있다. 서버 렌더에서는 undefined를 받아 화면을 비워두고,
  // 클라이언트에서 실제 저장값(없으면 null)으로 채운다.
  // 원시값을 스냅샷으로 받아야 렌더마다 같은 값이 보장된다.
  const savedRaw = useSyncExternalStore(subscribeNoop, readDemoRequestRaw, getServerSnapshot);
  const [selectedProposal, setSelectedProposal] = useState<LessonProposal | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const lessonRequest = savedRaw === undefined ? null : buildLessonRequest(savedRaw);

  const handleViewProfile = (offer: LessonProposal) => {
    setSelectedProposal(offer);
  };

  const handleDrawerClose = () => {
    setSelectedProposal(null);
  };

  // 삭제 확인 핸들러 — 실제로 지울 게 없으니 체험을 끝내고 메인으로 보낸다
  const handleDeleteConfirm = () => router.push('/');

  // 첫 렌더에는 저장값을 아직 못 읽어 화면을 비워둔다
  if (!lessonRequest) return null;

  const { proposals } = lessonRequest;

  return (
    <div className="mx-auto max-w-300 px-8 py-9">
      <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
        {/* 좌측 사이드바 - 나의 레슨 정보 */}
        <aside className="flex w-full flex-col lg:sticky lg:top-21 lg:w-75 lg:min-w-70 lg:shrink-0">
          <h2 className="mb-4 flex h-8 items-center text-base font-bold text-(--neutral-800)">내 레슨 신청</h2>
          <LessonRequestCard request={lessonRequest} onDelete={() => setDeleteDialogOpen(true)} />
        </aside>

        {/* 우측 메인 - 코치 레슨 제안 */}
        <main className="min-w-0 flex-1">
          <div className="mb-4 flex h-8 items-center gap-2.5">
            <h1 className="text-base font-bold text-(--neutral-800)">코치 제안</h1>
            <Badge variant="brand" dot>
              제안 {proposals.length}개 도착
            </Badge>
          </div>

          {/* 다음 행동 안내 — 프로필 보기가 채팅으로 이어진다는 걸 알려준다 */}
          <p className="mb-4 rounded-[10px] bg-(--green-50) px-4 py-3 text-sm text-(--green-800)">
            마음에 드는 코치의 <span className="font-bold">프로필 보기</span>를 눌러 상세를 확인하고 채팅을 시작해보세요.
          </p>

          <ul className="flex flex-col gap-4">
            {proposals.map(offer => (
              <li key={offer.id}>
                <LessonProposalCard offer={offer} onViewProfile={handleViewProfile} />
              </li>
            ))}
          </ul>
          <DemoCoachProfileDrawer offer={selectedProposal} onClose={handleDrawerClose} />
        </main>
      </div>

      <DeleteLessonDialog
        open={deleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}

// 이 화면에 머무는 동안 저장값이 바뀔 일이 없으므로 구독할 변경도 없다
const subscribeNoop = () => () => {};

// 서버에는 sessionStorage 자체가 없다는 뜻으로 undefined를 쓴다(값이 비어있는 null과 구분)
const getServerSnapshot = (): string | undefined => undefined;

// 저장된 신청서로 화면용 데이터를 만든다.
// 신청서를 거치지 않고 URL로 바로 들어와 저장값이 없으면 기본값으로 채운다.
function buildLessonRequest(raw: string | null): LessonRequest {
  const saved = parseDemoRequest(raw) ?? DEFAULT_REQUEST_VALUES;
  return {
    id: 'demo-request',
    studentId: 'demo-student',
    region: saved.region,
    genre: saved.genre,
    goal: saved.goal,
    createdAt: new Date().toISOString(),
    proposals: DEMO_PROPOSALS
  };
}
