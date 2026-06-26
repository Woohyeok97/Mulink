import { redirect } from 'next/navigation';
import { Mic } from 'lucide-react';
import { createClient } from '@/shared/lib/supabase/server';
import { CoachApplyForm } from '@/features/coach/apply/coachApplyForm';

export default async function CoachApplyPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/');
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[linear-gradient(150deg,var(--green-50)_0%,var(--green-100)_55%,var(--green-200)_100%)] px-6 py-10 sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-12%] right-[-12%] h-120 w-120 rounded-full bg-(--sand-100) opacity-55 blur-[72px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-8%] left-[-10%] h-90 w-90 rounded-full bg-(--green-300) opacity-40 blur-[72px]"
      />

      <div className="relative z-10 flex w-full max-w-100 flex-col items-center sm:rounded-2xl sm:border sm:border-white/60 sm:bg-white/[0.82] sm:px-12 sm:py-14 sm:shadow-(--shadow-xl) sm:backdrop-blur-[16px]">
        <div className="mb-12 flex items-center gap-2">
          <Mic className="size-7 stroke-2 text-(--green-700)" />
          <span className="text-xl font-extrabold leading-none tracking-tight text-(--green-800)">
            MU:LINK
          </span>
        </div>

        <div className="mb-10 text-center">
          <h1 className="mb-3 break-keep text-2xl font-extrabold leading-tight tracking-tighter text-(--green-800)">
            당신의 목소리로<br />코치가 되다
          </h1>
          <p className="break-keep text-base leading-normal text-(--neutral-500)">
            MU:LINK 코치로 등록하고<br />나에게 맞는 수강생을 만나 보세요.
          </p>
        </div>

        <CoachApplyForm />
      </div>
    </div>
  );
}
