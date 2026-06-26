import { MessageCircle, Mic } from 'lucide-react';

const WAVE_HEIGHTS = [10, 18, 26, 20, 32, 24, 16, 28, 22, 14, 30, 20, 12, 24, 18];

export default function LoginPage() {
  const kakaoLoginUrl = `${process.env.NEXT_PUBLIC_API_URL}/auth/kakao/authorize`;

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 py-10 [background:linear-gradient(150deg,var(--green-50)_0%,var(--green-100)_55%,var(--green-200)_100%)]">
      {/* 블롭 데코레이션 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-12%] right-[-12%] size-120 rounded-full bg-(--sand-100) opacity-55 filter-[blur(72px)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-8%] left-[-10%] size-90 rounded-full bg-(--green-300) opacity-40 filter-[blur(72px)]"
      />

      {/* 콘텐츠 카드 */}
      <div className="relative z-10 flex w-full max-w-100 flex-col items-center sm:rounded-2xl sm:border sm:border-white/60 sm:bg-white/82 sm:px-12 sm:py-14 sm:[backdrop-filter:blur(16px)] sm:[box-shadow:var(--shadow-xl)]">
        {/* 로고 */}
        <div className="mb-12 flex items-center gap-1">
          <Mic size={28} color="var(--green-700)" aria-hidden="true" />
          <span className="text-(length:--text-xl) font-(--weight-extrabold) tracking-tight leading-none text-(--green-800)">
            MU:LINK
          </span>
        </div>

        {/* 웨이브폼 데코레이션 */}
        <div className="mb-1 flex h-8 items-center justify-center gap-0.75" aria-hidden="true">
          {WAVE_HEIGHTS.map((height, index) => (
            <div key={index} className="w-0.75 rounded-full bg-(--green-400) opacity-60" style={{ height }} />
          ))}
        </div>

        {/* 헤드라인 */}
        <div className="mb-24 mt-5 text-center">
          <h1 className="mb-4 break-keep whitespace-pre-line text-(length:--text-2xl) font-(--weight-extrabold) leading-tight tracking-tighter text-(--green-800)">
            {'숨겨진 내 목소리의\n가치를 찾다'}
          </h1>
          <p className="break-keep whitespace-pre-line text-(length:--text-base) leading-normal text-(--neutral-500)">
            {'목소리를 녹음하면 전문가가 직접 분석해\n나에게 맞는 보컬 코치를 매칭해 드려요.'}
          </p>
        </div>

        {/* 카카오 로그인 버튼 */}
        <a
          href={kakaoLoginUrl}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#FEE500] px-6 py-3 text-(length:--text-base) font-(--weight-semibold) text-black/85 hover:bg-[#F5DC00] active:bg-[#EDD000]">
          <MessageCircle size={20} fill="rgba(0,0,0,0.85)" stroke="none" aria-hidden="true" />
          카카오로 시작하기
        </a>
      </div>
    </div>
  );
}
