'use client';

import { useRouter } from 'next/navigation';
// components
import { REGION_LABEL, type LessonProposal } from '@/entities/lesson-request/lesson-request.type';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar/avatar';
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
import { MapPin, MessageCircle } from 'lucide-react';

interface DemoCoachProfileDrawerProps {
  offer: LessonProposal | null;
  onClose: () => void;
}

// 프로덕션 CoachProfileDrawer의 데모판. 채팅방을 만들지 않고 데모 채팅으로 바로 보낸다.
export function DemoCoachProfileDrawer({ offer, onClose }: DemoCoachProfileDrawerProps) {
  const router = useRouter();

  // 채팅 버튼 핸들러
  const handleChat = () => router.push('/demo/student/chat');

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
                  <AvatarImage src={offer.coachProfile.imageUrl ?? undefined} alt={offer.coachProfile.activityName} />
                  <AvatarFallback>{offer.coachProfile.activityName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <DrawerTitle className="text-base font-semibold">{offer.coachProfile.activityName}</DrawerTitle>
                  <DrawerDescription className="sr-only">
                    코치 {offer.coachProfile.activityName}의 프로필 상세
                  </DrawerDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="brand" className="rounded-full">
                    <MapPin />
                    {REGION_LABEL[offer.coachProfile.region]}
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
                      <td className="py-2.5 text-(--neutral-500)">활동 지역</td>
                      <td className="py-2.5 text-right font-medium text-(--neutral-800)">
                        {REGION_LABEL[offer.coachProfile.region]}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </div>

            <DrawerFooter className="gap-2 p-6 pt-4">
              <Button
                variant="default"
                size="default"
                leftIcon={<MessageCircle size={20} aria-hidden="true" />}
                onClick={handleChat}>
                채팅하기
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
