'use client';

import Link from 'next/link';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { Button } from '@/shared/ui/button/button';

interface DemoProposalSentDialogProps {
  open: boolean;
  onClose: () => void;
}

// 제안을 보낸 직후 뜨는 안내 모달 — 학생이 상담을 걸어올 수 있다는 걸 알려주고 채팅으로 보낸다.
// 스타일은 DemoGuideDialog와 동일하게 검은 반투명 + 상단 배치.
export function DemoProposalSentDialog({ open, onClose }: DemoProposalSentDialogProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose();
      }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="fixed top-20 left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col gap-6 rounded-2xl bg-white p-6 shadow-xl duration-100 outline-none sm:max-w-105 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0">
          <div className="flex flex-col gap-3">
            <DialogPrimitive.Title className="text-base font-bold text-(--neutral-900)">
              레슨 제안을 보냈어요
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm leading-relaxed text-(--neutral-600)">
              제안을 받은 학생이 마음에 들면 코치님에게 1:1 상담을 신청할 수 있어요.
              <br />
              학생이 상담을 요청하면 채팅에서 대화를 나눌 수 있어요.
            </DialogPrimitive.Description>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="default" onClick={onClose}>
              목록으로
            </Button>
            <Button variant="emphasis" size="default">
              <Link href="/demo/coach/chat">채팅하러 가기</Link>
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
