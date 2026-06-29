'use client';

import { useState } from 'react';

import { type LessonOffer, type LessonRequest } from '@/entities/lesson-request/lesson-request.type';
import { Badge } from '@/shared/ui/badge/badge';

import { AcceptCoachDialog } from './AcceptCoachDialog';
import { ApplicationSummary } from './ApplicationSummary';
import { CoachProfileDrawer } from './CoachProfileDrawer';
import { ProposalCard } from './ProposalCard';

type LessonMeViewProps = {
  request: LessonRequest;
  offers: LessonOffer[];
};

export function LessonMeView({ request, offers }: LessonMeViewProps) {
  const [selectedOffer, setSelectedOffer] = useState<LessonOffer | null>(null);
  const [acceptOffer, setAcceptOffer] = useState<LessonOffer | null>(null);

  function handleViewProfile(offer: LessonOffer) {
    setSelectedOffer(offer);
  }

  function handleDrawerClose() {
    setSelectedOffer(null);
  }

  function handleAccept(offer: LessonOffer) {
    setSelectedOffer(null);
    setAcceptOffer(offer);
  }

  function handleDialogClose() {
    setAcceptOffer(null);
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
        {/* 좌측 사이드바 */}
        <aside className="w-full lg:sticky lg:top-20 lg:w-[300px] lg:shrink-0">
          <ApplicationSummary request={request} />
        </aside>

        {/* 우측 메인 */}
        <main className="flex flex-1 flex-col gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[var(--neutral-800)]">코치 제안</h1>
            <Badge variant="brand">{offers.length}개</Badge>
          </div>

          {offers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--neutral-200)] bg-white py-16 text-center shadow-[var(--shadow-sm)]">
              <p className="text-base font-medium text-[var(--neutral-600)]">아직 제안이 없어요</p>
              <p className="text-sm text-[var(--neutral-400)]">코치들이 신청서를 검토 중이에요</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {offers.map((offer) => (
                <li key={offer.id}>
                  <ProposalCard offer={offer} onViewProfile={handleViewProfile} />
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>

      <CoachProfileDrawer
        offer={selectedOffer}
        onClose={handleDrawerClose}
        onAccept={handleAccept}
      />

      <AcceptCoachDialog offer={acceptOffer} onClose={handleDialogClose} />
    </div>
  );
}
