import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { REGIONS, GENRES, type RegionValue, type GenreValue } from '../../lesson-register.schema';

type SuccessViewProps = {
  region: RegionValue;
  genre: GenreValue;
};

export function SuccessView({ region, genre }: SuccessViewProps) {
  const regionLabel = REGIONS.find(item => item.value === region)?.label ?? region;
  const genreLabel = GENRES.find(item => item.value === genre)?.label ?? genre;

  return (
    <div className="flex w-full max-w-130 flex-col gap-7">
      <div className="flex size-16 items-center justify-center rounded-full bg-(--green-100)">
        <Check className="size-7 text-(--green-600)" strokeWidth={2.5} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-(--green-800)">신청이 완료됐어요!</h2>
        <p className="text-sm leading-relaxed text-(--neutral-500)">
          나에게 맞는 코치를 찾고 있어요.
          <br />
          잠시 후 매칭 결과를 알려드릴게요.
        </p>
      </div>

      <div className="flex flex-col gap-3.5 rounded-lg bg-(--neutral-50) px-5 py-5">
        <SummaryRow label="지역" value={regionLabel} />
        <SummaryRow label="선호 장르" value={genreLabel} />
      </div>

      <Link
        href="/student/lesson-request"
        className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-(--green-700) hover:text-(--green-800)">
        현황 보러가기
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs font-medium text-(--neutral-400)">{label}</span>
      <span className="text-right text-sm font-medium text-(--neutral-800)">{value}</span>
    </div>
  );
}
