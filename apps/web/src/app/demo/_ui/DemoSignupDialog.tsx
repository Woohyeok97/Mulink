'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

interface DemoSignupDialogProps {
  open: boolean;
  onClose: () => void;
}

// 채팅 답장이 모두 소진된 뒤 뜨는 가입 유도 모달 — 체험의 마지막 화면.
// 학생·코치 데모가 공유하며, 문구도 둘 다에 어울리는 공통 문장을 쓴다.
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
        <DialogPrimitive.Content className="fixed top-20 left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col gap-6 rounded-2xl bg-white p-6 shadow-xl duration-100 outline-none sm:max-w-105 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0">
          <div className="flex flex-col gap-3">
            <DialogPrimitive.Title className="text-base font-bold text-(--neutral-900)">
              체험은 어떠셨나요?
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm leading-relaxed text-(--neutral-600)">
              지금 카카오로 로그인하고, 실제 서비스에서 레슨 매칭을 시작해보세요.
            </DialogPrimitive.Description>
          </div>

          {/* 로그인 페이지의 카카오 로그인 버튼과 동일한 스타일 */}
          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#FEE500] px-6 py-3 text-base font-semibold text-black/85 hover:bg-[#F5DC00] active:bg-[#EDD000]">
            <MessageCircle size={20} fill="rgba(0,0,0,0.85)" stroke="none" aria-hidden="true" />
            카카오로 시작하기
          </Link>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
