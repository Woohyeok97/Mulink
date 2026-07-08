'use client';

import { Clock } from 'lucide-react';

import { REGION_LABEL, type LessonProposal } from '@/entities/lesson-request/lesson-request.type';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar/avatar';
import { Button } from '@/shared/ui/button/button';

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}일 전`;
}

interface LessonProposalCardProps {
  offer: LessonProposal;
  onViewProfile: (offer: LessonProposal) => void;
}

export function LessonProposalCard({ offer, onViewProfile }: LessonProposalCardProps) {
  const { coachProfile, message } = offer;
  const initial = coachProfile.activityName.charAt(0);

  return (
    <div className="rounded-2xl border border-(--neutral-200) bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-lg)">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar size="default">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-(--neutral-900)">{coachProfile.activityName}</span>
            <span className="text-xs text-(--neutral-500)">{REGION_LABEL[coachProfile.region]}</span>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-(--neutral-400)">
          <Clock className="size-3" />
          {formatRelativeTime(offer.createdAt)}
        </span>
      </div>

      <div className="mt-4 rounded-[10px] bg-(--neutral-50) p-3.5">
        <p className="text-sm leading-relaxed text-(--neutral-700)">{message}</p>
      </div>

      <Button variant="outline" size="default" className="mt-4 w-full" onClick={() => onViewProfile(offer)}>
        프로필 보기
      </Button>
    </div>
  );
}
