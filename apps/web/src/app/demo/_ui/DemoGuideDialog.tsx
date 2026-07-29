'use client';

import { useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { Button } from '@/shared/ui/button/button';

interface DemoGuideDialogProps {
  title: string;
  description: React.ReactNode;
  confirmText: string;
}

// 데모 페이지 진입 시 한 번 뜨는 안내 모달. 닫으면 그 페이지에서는 다시 뜨지 않는다.
// shared/ui/dialog는 오버레이가 blur로 고정돼 있고 화면 정중앙에 뜨므로,
// 여기서는 radix 원시 컴포넌트로 직접 조립해 검은 반투명 + 상단 배치로 둔다.
export function DemoGuideDialog({ title, description, confirmText }: DemoGuideDialogProps) {
  const [open, setOpen] = useState(true);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="fixed top-20 left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col gap-6 rounded-2xl bg-white p-6 shadow-xl duration-100 outline-none sm:max-w-105 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0">
          <div className="flex flex-col gap-3">
            <DialogPrimitive.Title className="text-base font-bold text-(--neutral-900)">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm leading-relaxed text-(--neutral-600)">
              {description}
            </DialogPrimitive.Description>
          </div>

          <Button variant="emphasis" size="default" className="w-full" onClick={() => setOpen(false)}>
            {confirmText}
          </Button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
