import Link from 'next/link';

import { Button } from '@/shared/ui/button/button';

export function EmptyApplication() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-lg font-semibold text-[var(--neutral-700)]">아직 신청한 레슨이 없어요</p>
      <p className="text-sm text-[var(--neutral-400)]">코치를 찾고 있다면 레슨을 신청해 보세요.</p>
      <Button asChild variant="default">
        <Link href="/lesson/register">레슨 신청하기</Link>
      </Button>
    </div>
  );
}
