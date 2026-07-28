import Link from 'next/link';
import { ArrowRight, ClipboardList, Sparkles, UserPlus, Users } from 'lucide-react';

import { getCurrentUser } from '@/entities/user/user.api';
import { Button } from '@/shared/ui/button/button';

// 이용 방법 3단계
const STEPS = [
  {
    Icon: ClipboardList,
    title: '레슨 신청 등록',
    desc: '지역, 레슨 목적, 선호 장르를 남기고 레슨 신청을 올려요.'
  },
  {
    Icon: Sparkles,
    title: '코치의 제안 받기',
    desc: '관심있는 코치들이 프로필과 한마디를 담아 제안을 보내요.'
  },
  {
    Icon: Users,
    title: '마음에 드는 코치 확인',
    desc: '받은 제안들을 비교해보고, 마음에 드는 코치를 찾아요.'
  }
];

export default async function Home() {
  const user = await getCurrentUser();
  const loggedIn = user !== null;
  const isCoach = user?.role === 'COACH';

  return (
    <main>
      {/* 히어로 — 텍스트 중심 */}
      <section className="bg-[linear-gradient(180deg,var(--green-50)_0%,#fff_100%)]">
        <div className="mx-auto flex max-w-300 flex-col items-center px-8 pt-24 pb-20 text-center max-sm:px-7 max-sm:pt-14 max-sm:pb-12">
          <p className="mb-2.5 text-xs font-semibold tracking-[0.08em] text-(--green-700) uppercase">
            역방향 레슨 매칭
          </p>
          <h1 className="max-w-180 text-[44px] font-extrabold tracking-[-0.02em] text-(--neutral-900) max-md:text-[32px]">
            레슨을 신청하면,
            <br />
            코치가 찾아와요
          </h1>
          <p className="mx-auto mt-2.5 max-w-140 text-[17px] leading-[1.55] text-(--neutral-500)">
            지역과 목적, 선호 장르만 남겨두세요. 관심있는 보컬 코치들이 먼저 제안을 보내드려요.
          </p>
          <div className="mt-7.5 flex w-full justify-center gap-3 max-sm:flex-col max-sm:items-stretch">
            {/* 비로그인은 가입 없이 흐름을 둘러보는 체험으로, 로그인 상태면 역할에 맞는 실제 화면으로 */}
            {!loggedIn ? (
              <Button variant="emphasis" size="lg" className="rounded-full max-sm:w-full" rightIcon={<ArrowRight />}>
                <Link href="/demo/student">학생 체험해보기</Link>
              </Button>
            ) : (
              <Button variant="emphasis" size="lg" className="rounded-full max-sm:w-full" rightIcon={<ArrowRight />}>
                {isCoach ? (
                  <Link href="/coach/lesson-requests">레슨 제안하기</Link>
                ) : (
                  <Link href="/student/lesson-request/new">레슨 신청하기</Link>
                )}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* 이용 방법 */}
      <section className="mx-auto max-w-300 px-8 py-22 max-sm:px-7 max-sm:py-14">
        <div className="mb-12 text-center">
          <p className="mb-2.5 text-xs font-semibold tracking-[0.08em] text-(--green-700) uppercase">이용 방법</p>
          <h2 className="text-[32px] font-extrabold tracking-[-0.02em] text-(--neutral-900) max-md:text-[26px]">
            3단계면 충분해요
          </h2>
          <p className="mx-auto mt-2.5 max-w-140 text-base leading-[1.55] text-(--neutral-500)">
            복잡한 절차 없이, 신청 한 번으로 여러 코치의 제안을 받아볼 수 있어요.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-6 max-md:grid-cols-1">
          {STEPS.map(({ Icon, title, desc }, i) => (
            <div
              key={title}
              className="flex flex-col gap-3.5 rounded-[20px] border border-(--neutral-200) bg-white p-8">
              <div className="mb-0.5 flex size-11 items-center justify-center rounded-[14px] bg-(--green-50) text-(--green-700)">
                <Icon size={22} />
              </div>
              <span className="font-mono text-[13px] font-bold text-(--green-600)">STEP {i + 1}</span>
              <h3 className="text-lg font-bold text-(--neutral-900)">{title}</h3>
              <p className="text-sm leading-[1.55] text-(--neutral-500)">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 바로 시작하기 — 학생/코치 배너 */}
      <section className="mx-auto max-w-300 px-8 pb-24 max-sm:px-7 max-sm:pb-16">
        <p className="mb-2.5 text-xs font-semibold tracking-[0.08em] text-(--green-700) uppercase">바로 시작하기</p>
        <h2 className="mt-1 mb-8 text-[32px] font-extrabold tracking-[-0.02em] text-(--neutral-900) max-md:text-[26px]">
          나에게 맞는 방법으로 시작해요
        </h2>

        <div className="flex flex-col gap-5">
          {/* 학생 배너 — 코치로 로그인 시 숨김 */}
          {!isCoach && (
            <div className="grid grid-cols-[64px_1.3fr_1fr] items-center gap-7 rounded-[28px] bg-(--green-50) px-11 py-10 max-md:grid-cols-1 max-md:p-8 max-sm:gap-4 max-sm:rounded-[22px] max-sm:p-6">
              <div className="flex size-16 items-center justify-center rounded-[20px] bg-(--green-800) text-white">
                <ClipboardList size={30} />
              </div>
              <div>
                <h3 className="mb-1.5 text-[22px] font-bold text-(--neutral-900)">학생이신가요?</h3>
                <p className="max-w-90 text-sm leading-[1.55] text-(--neutral-600)">
                  내가 원하는 레슨 조건을 올려두면, 코치들이 먼저 제안을 보내드려요.
                </p>
              </div>
              <div className="justify-self-end max-md:justify-self-start max-sm:w-full">
                <Button variant="emphasis" className="rounded-full max-sm:w-full" rightIcon={<ArrowRight />}>
                  {loggedIn ? (
                    <Link href="/student/lesson-request/new">레슨 신청하기</Link>
                  ) : (
                    <Link href="/login">로그인하고 레슨 신청하기</Link>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* 코치 배너 */}
          <div className="grid grid-cols-[64px_1.3fr_1fr] items-center gap-7 rounded-[28px] bg-(--sand-100) px-11 py-10 max-md:grid-cols-1 max-md:p-8 max-sm:gap-4 max-sm:rounded-[22px] max-sm:p-6">
            <div className="flex size-16 items-center justify-center rounded-[20px] bg-(--green-800) text-white">
              <Users size={30} />
            </div>
            <div>
              <h3 className="mb-1.5 text-[22px] font-bold text-(--neutral-900)">코치이신가요?</h3>
              <p className="max-w-90 text-sm leading-[1.55] text-(--neutral-600)">
                학생들의 레슨 신청을 둘러보고, 마음에 드는 신청에 제안을 보내보세요.
              </p>
            </div>
            <div className="justify-self-end max-md:justify-self-start max-sm:w-full">
              {/* 비로그인 → 로그인 / 코치 → 신청 목록 / 학생 → 코치 가입 */}
              {!loggedIn ? (
                <Button variant="outline" className="rounded-full max-sm:w-full" rightIcon={<ArrowRight />}>
                  <Link href="/login">로그인하고 시작하기</Link>
                </Button>
              ) : isCoach ? (
                <Button variant="outline" className="rounded-full max-sm:w-full" rightIcon={<ArrowRight />}>
                  <Link href="/coach/lesson-requests">레슨 신청 목록 보기</Link>
                </Button>
              ) : (
                <Button variant="outline" className="rounded-full max-sm:w-full" leftIcon={<UserPlus />}>
                  <Link href="/coach-register">코치로 가입하기</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
