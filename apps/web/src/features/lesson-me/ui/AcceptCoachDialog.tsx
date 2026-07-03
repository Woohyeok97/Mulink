'use client';

import { REGION_LABEL, type LessonOffer } from '@/entities/lesson-request/lesson-request.type';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar/avatar';
import { Button } from '@/shared/ui/button/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/dialog/dialog';

type AcceptCoachDialogProps = {
  offer: LessonOffer | null;
  onClose: () => void;
};

export function AcceptCoachDialog({ offer, onClose }: AcceptCoachDialogProps) {
  return (
    <Dialog
      open={!!offer}
      onOpenChange={open => {
        if (!open) onClose();
      }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>이 코치와 매칭할까요?</DialogTitle>
          {offer && (
            <DialogDescription>
              {offer.coach.activityName} 코치의 제안을 수락하면 나머지 제안은 자동으로 거절돼요.
            </DialogDescription>
          )}
        </DialogHeader>

        {offer && (
          <div className="flex items-center gap-3 rounded-xl bg-(--neutral-50) p-4">
            <Avatar size="default">
              <AvatarFallback>{offer.coach.activityName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-(--neutral-800)">{offer.coach.activityName}</span>
              <span className="text-xs text-(--neutral-500)">
                {REGION_LABEL[offer.coach.region]} · {offer.coach.career}년 경력
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="default" onClick={onClose}>
            취소
          </Button>
          <Button variant="emphasis" size="default">
            수락 확정
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
