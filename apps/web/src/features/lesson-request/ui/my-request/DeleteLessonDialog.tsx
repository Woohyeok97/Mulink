'use client';

import { Button } from '@/shared/ui/button/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/dialog/dialog';

interface DeleteLessonDialogProps {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting?: boolean;
}

export function DeleteLessonDialog({ open, onConfirm, onClose, isDeleting }: DeleteLessonDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose();
      }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>신청을 삭제할까요?</DialogTitle>
          <DialogDescription>
            삭제하면 현재 받은 코치 제안이 모두 사라져요. 삭제 후 다시 신청하실 수 있어요.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" size="default" onClick={onClose} disabled={isDeleting}>
            취소
          </Button>
          <Button variant="destructive" size="default" onClick={onConfirm} loading={isDeleting}>
            신청 취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
