'use client';

// components
import { REGION_LABEL, type LessonOffer } from '@/entities/lesson-request/lesson-request.type';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar/avatar';
import { Badge } from '@/shared/ui/badge/badge';
import { Button } from '@/shared/ui/button/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/shared/ui/drawer/drawer';
// icons
import { MapPin, Users, MessageCircle } from 'lucide-react';

interface CoachProfileDrawerProps {
  offer: LessonOffer | null;
  onClose: () => void;
}

export function CoachProfileDrawer({ offer, onClose }: CoachProfileDrawerProps) {
  return (
    <Drawer
      direction="right"
      open={!!offer}
      onOpenChange={open => {
        if (!open) onClose();
      }}>
      <DrawerContent>
        {offer && (
          <>
            <DrawerHeader className="p-6 pb-0">
              <div className="flex flex-col items-center gap-3 pb-4">
                <Avatar size="lg">
                  <AvatarFallback>{offer.coach.activityName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <DrawerTitle className="text-base font-semibold">{offer.coach.activityName}</DrawerTitle>
                  <DrawerDescription className="sr-only">
                    코치 {offer.coach.activityName}의 프로필 상세
                  </DrawerDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="brand" className="rounded-full">
                    <MapPin />
                    {REGION_LABEL[offer.coach.region]}
                  </Badge>
                  <Badge variant="brand" className="rounded-full">
                    <Users />
                    {offer.coach.career}년 경력
                  </Badge>
                </div>
              </div>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <section className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--neutral-400)">
                  코치의 한마디
                </h3>
                <div className="rounded-xl bg-(--neutral-50) p-4">
                  <p className="text-sm leading-relaxed text-(--neutral-700)">{offer.message}</p>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-(--neutral-400)">코치 정보</h3>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-(--neutral-100)">
                    <tr>
                      <td className="py-2.5 text-(--neutral-500)">경력</td>
                      <td className="py-2.5 text-right font-medium text-(--neutral-800)">{offer.coach.career}년</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-(--neutral-500)">활동 지역</td>
                      <td className="py-2.5 text-right font-medium text-(--neutral-800)">
                        {REGION_LABEL[offer.coach.region]}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </div>

            <DrawerFooter className="gap-2 p-6 pt-4">
              <Button
                variant="outline"
                size="default"
                className="bg-[#FEE500]"
                leftIcon={<MessageCircle size={20} fill="rgba(0,0,0,0.85)" stroke="none" aria-hidden="true" />}
                onClick={() => {}}>
                카톡 1:1 상담
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
