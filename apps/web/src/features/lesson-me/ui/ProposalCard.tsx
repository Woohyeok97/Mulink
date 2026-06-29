'use client';

import { MessageSquare } from 'lucide-react';

import { REGION_LABEL, type LessonOffer } from '@/entities/lesson-request/lesson-request.type';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar/avatar';
import { Button } from '@/shared/ui/button/button';

type ProposalCardProps = {
  offer: LessonOffer;
  onViewProfile: (offer: LessonOffer) => void;
};

export function ProposalCard({ offer, onViewProfile }: ProposalCardProps) {
  const { coach, message } = offer;
  const initial = coach.activityName.charAt(0);

  return (
    <div className="rounded-2xl border border-[var(--neutral-200)] bg-white p-5 shadow-[var(--shadow-sm)] transition-shadow duration-200 hover:shadow-[var(--shadow-lg)]">
      <div className="flex items-center gap-3">
        <Avatar size="default">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-[var(--neutral-800)]">{coach.activityName}</span>
          <span className="text-xs text-[var(--neutral-500)]">
            {REGION_LABEL[coach.region]} · {coach.career}년 경력
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-[var(--neutral-50)] p-3">
        <MessageSquare className="mt-0.5 size-4 shrink-0 text-[var(--neutral-400)]" />
        <p className="text-sm leading-relaxed text-[var(--neutral-700)]">{message}</p>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => onViewProfile(offer)}>
          프로필 보기
        </Button>
      </div>
    </div>
  );
}
