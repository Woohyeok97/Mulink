'use client';

import Link from 'next/link';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { Button } from '@/shared/ui/button/button';

interface DemoSignupDialogProps {
  open: boolean;
  onClose: () => void;
}

// 채팅 답장이 모두 소진된 뒤 뜨는 가입 유도 모달 — 체험의 마지막 화면.
// 스타일은 DemoGuideDialog와 동일하게 검은 반투명 + 상단 배치.
export function DemoSignupDialog({ open, onClose }: DemoSignupDialogProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose();
      }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="fixed top-20 left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl duration-100 outline-none sm:max-w-105 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0">
          <div className="flex flex-col gap-2">
            <DialogPrimitive.Title className="text-base font-bold text-(--neutral-900)">
              체험은 여기까지예요
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm leading-relaxed text-(--neutral-600)">
              로그인하면 실제로 레슨을 신청하고, 코치의 제안을 받아 자유롭게 대화할 수 있어요.
            </DialogPrimitive.Description>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="default" onClick={onClose}>
              더 둘러보기
            </Button>
            <Button variant="emphasis" size="default">
              <Link href="/login">카카오로 시작하기</Link>
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
