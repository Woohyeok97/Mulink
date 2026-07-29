'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// components
import { Badge } from '@/shared/ui/badge/badge';
import { LessonRequestCard } from './LessonRequestCard';
import { CoachProfileDrawer } from './CoachProfileDrawer';
import { DeleteLessonDialog } from './DeleteLessonDialog';
import { LessonProposalCard } from './LessonProposalCard';
// icons
import { Clock, Users } from 'lucide-react';
// types
import { type LessonProposal, type LessonRequest } from '@/entities/lesson-request/lesson-request.type';
// mutations
import { useDeleteLessonRequestMutation } from '../../lesson-request.mutate';

interface MyLessonRequestViewProps {
  lessonRequest: LessonRequest;
}

export function MyLessonRequestView({ lessonRequest }: MyLessonRequestViewProps) {
  const { proposals } = lessonRequest;
  const router = useRouter();
  const [selectedProposal, setSelectedProposal] = useState<LessonProposal | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleViewProfile = (offer: LessonProposal) => {
    setSelectedProposal(offer);
  };

  const handleDrawerClose = () => {
    setSelectedProposal(null);
  };

  // 레슨 신청 취소 mutate
  const { mutate, isPending } = useDeleteLessonRequestMutation({
    onSuccess: result => {
      if (result?.error) {
        alert(result.error);
        return;
      }
      setDeleteDialogOpen(false);
      router.refresh();
    }
  });

  // 레슨 신청 취소 핸들러
  const handleDeleteConfirm = () => mutate(lessonRequest.id);

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
              {proposals.length === 0 ? '검토 중' : `제안 ${proposals.length}개 도착`}
            </Badge>
          </div>

          {proposals.length === 0 ? (
            // 레슨 제안이 없는 경우
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-(--neutral-200) bg-white py-16 text-center">
              <div className="flex size-20 items-center justify-center rounded-full bg-(--green-50) text-(--green-300)">
                <Users className="size-9" />
              </div>
              <div>
                <p className="mb-2 text-[17px] font-bold text-(--neutral-800)">아직 제안이 없어요</p>
                <p className="text-sm leading-relaxed text-(--neutral-500)">
                  코치들이 신청서를 검토 중이에요.
                  <br />
                  보통 몇 시간 내에 제안이 도착해요.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-[10px] bg-(--warning-100) px-4 py-2.5">
                <Clock className="size-3.5 text-(--warning-700)" />
                <span className="text-sm font-medium text-(--warning-700)">
                  평균 대기 시간 · <span className="font-mono font-bold">2–4</span>시간
                </span>
              </div>
            </div>
          ) : (
            // 레슨 제안이 있는 경우
            <>
              <ul className="flex flex-col gap-4">
                {proposals.map(offer => (
                  <li key={offer.id}>
                    <LessonProposalCard offer={offer} onViewProfile={handleViewProfile} />
                  </li>
                ))}
              </ul>
              <CoachProfileDrawer offer={selectedProposal} onClose={handleDrawerClose} />
            </>
          )}
        </main>
      </div>

      <DeleteLessonDialog
        open={deleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteDialogOpen(false)}
        isDeleting={isPending}
      />
    </div>
  );
}
