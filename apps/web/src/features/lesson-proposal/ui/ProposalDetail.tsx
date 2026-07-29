'use client';

import { useRouter } from 'next/navigation';
// components
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/shared/ui/button/button';
// types
import type { MyProposal } from '@/entities/lesson-request/lesson-request.type';
// mutations
import { useDeleteLessonProposalMutation } from '../lesson-proposal.mutate';
// utils
import { toAbsoluteTime } from '@/shared/lib/absolute-time';

interface ProposalDetailProps {
  proposal: MyProposal;
  onCancelled: () => void;
}

// 이미 보낸 제안의 한마디·발송 시각을 보여주고, 취소할 수 있는 상세 영역
export function ProposalDetail({ proposal, onCancelled }: ProposalDetailProps) {
  const router = useRouter();

  // 레슨 제안 취소 mutate
  const { mutate, isPending } = useDeleteLessonProposalMutation({
    onSuccess: result => {
      if (result?.error) {
        alert(result.error);
        return;
      }
      onCancelled();
      router.refresh(); // 서버 목록 재검증 → 다시 '제안 가능' 상태로
    }
  });

  // 제안 취소 핸들러 (확인 없이 즉시 취소)
  const handleCancelProposal = () => mutate(proposal.id);

  return (
    <div className="animate-in fade-in-0 slide-in-from-top-2 duration-200 border-t border-(--neutral-100) bg-(--green-50) px-5 py-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-(--green-700)">
        <Sparkles size={13} />
        내가 보낸 레슨 제안
      </div>
      <div className="rounded-xl border border-(--neutral-200) bg-white px-4 py-3.5 text-sm leading-relaxed text-(--neutral-800)">
        {proposal.message}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-(--neutral-400)">{toAbsoluteTime(proposal.createdAt)} 전송</span>
        <Button
          size="sm"
          variant="destructive"
          loading={isPending}
          onClick={handleCancelProposal}
          leftIcon={<X size={13} />}>
          레슨 제안 취소
        </Button>
      </div>
    </div>
  );
}
