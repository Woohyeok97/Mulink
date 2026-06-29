'use client';

import { MapPin, Users } from 'lucide-react';

import { REGION_LABEL, type LessonOffer } from '@/entities/lesson-request/lesson-request.type';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar/avatar';
import { Button } from '@/shared/ui/button/button';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/ui/drawer/drawer';

type CoachProfileDrawerProps = {
  offer: LessonOffer | null;
  onClose: () => void;
  onAccept: (offer: LessonOffer) => void;
};

export function CoachProfileDrawer({ offer, onClose, onAccept }: CoachProfileDrawerProps) {
  return (
    <Drawer direction="right" open={!!offer} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent>
        {offer && (
          <>
            <DrawerHeader className="p-6 pb-0">
              <div className="flex flex-col items-center gap-3 pb-4">
                <Avatar size="lg">
                  <AvatarFallback>{offer.coach.activityName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <DrawerTitle className="text-base font-semibold">
                    {offer.coach.activityName}
                  </DrawerTitle>
                  <p className="mt-1 text-sm text-[var(--neutral-500)]">
                    {REGION_LABEL[offer.coach.region]}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--green-100)] px-3 py-1 text-xs font-medium text-[var(--green-800)]">
                    <MapPin className="size-3" />
                    {REGION_LABEL[offer.coach.region]}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--green-100)] px-3 py-1 text-xs font-medium text-[var(--green-800)]">
                    <Users className="size-3" />
                    {offer.coach.career}년 경력
                  </span>
                </div>
              </div>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <section className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--neutral-400)]">
                  코치의 한마디
                </h3>
                <div className="rounded-xl bg-[var(--neutral-50)] p-4">
                  <p className="text-sm leading-relaxed text-[var(--neutral-700)]">{offer.message}</p>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--neutral-400)]">
                  코치 정보
                </h3>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-[var(--neutral-100)]">
                    <tr>
                      <td className="py-2.5 text-[var(--neutral-500)]">경력</td>
                      <td className="py-2.5 text-right font-medium text-[var(--neutral-800)]">
                        {offer.coach.career}년
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-[var(--neutral-500)]">활동 지역</td>
                      <td className="py-2.5 text-right font-medium text-[var(--neutral-800)]">
                        {REGION_LABEL[offer.coach.region]}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </div>

            <DrawerFooter className="gap-2 p-6 pt-4">
              <Button variant="outline" size="default" onClick={() => {}}>
                카톡 1:1 상담
              </Button>
              <Button variant="emphasis" size="default" onClick={() => onAccept(offer)}>
                이 코치 수락하기
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
