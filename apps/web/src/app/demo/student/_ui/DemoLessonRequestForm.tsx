'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// components
import { SidePanel } from '@/features/lesson-request/ui/register/SidePanel';
import { MapPin, Music, Target, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/shared/ui/button/button';
import { Textarea } from '@/shared/ui/textarea/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select/select';
// schemas
import { LessonRequestSchema, REGIONS, GENRES, type LessonRequestFormType } from '@/features/lesson-request/lesson-request.schema';
// demo
import { DEFAULT_REQUEST_VALUES } from '../_lib/demo-fixtures';
import { saveDemoRequest } from '../_lib/demo-storage';

// 프로덕션 LessonRequestForm의 데모판. 폼 UI는 같고, 제출이 DB 대신 sessionStorage로 간다.
export function DemoLessonRequestForm() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState<LessonRequestFormType | null>(null);

  const { register, control, handleSubmit, formState } = useForm<LessonRequestFormType>({
    resolver: zodResolver(LessonRequestSchema),
    // 체험자가 바로 제출해볼 수 있도록 미리 채워둔다(수정 가능)
    defaultValues: DEFAULT_REQUEST_VALUES
  });

  // 폼 상태
  const { isValid } = formState;

  // 지역 선택 controller
  const { field: regionField } = useController({ name: 'region', control });

  // 선호 장르 controller
  const { field: genreField } = useController({ name: 'genre', control });

  // 레슨 신청 핸들러 — 저장 없이 다음 화면으로 넘길 값만 남긴다
  const onSubmit = handleSubmit(data => {
    saveDemoRequest(data);
    setSubmitted(data);
  });

  // 레슨 신청 버튼 활성화 상태
  const canSubmit = [isValid].every(Boolean);

  return (
    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      <SidePanel control={control} />

      <main className="flex flex-1 flex-col justify-start overflow-y-auto bg-white px-5 py-7 sm:justify-center sm:px-10 sm:py-11 lg:px-22 lg:py-16">
        {submitted ? (
          <div className="mx-auto flex w-full max-w-130 flex-1 flex-col justify-center">
            <DemoSuccessView values={submitted} onNext={() => router.push('/demo/student/lesson-request')} />
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="mx-auto flex w-full max-w-130 flex-col">
            {/* 헤딩 */}
            <div className="mb-8">
              <span className="mb-3.5 inline-flex items-center rounded-full bg-(--green-100) px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-(--green-700)">
                LESSON APPLY
              </span>
              <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight text-(--green-800)">신청서 작성</h1>
              <p className="text-sm text-(--neutral-500)">1분이면 충분해요. 아래 항목을 입력해 주세요.</p>
            </div>

            <div className="flex flex-col gap-6">
              {/* 지역 */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="region"
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-(--neutral-700)">
                  <MapPin className="size-3.5 text-(--green-600)" />
                  지역
                </label>
                <Select value={regionField.value ?? undefined} onValueChange={regionField.onChange}>
                  <SelectTrigger id="region" className="w-full">
                    <SelectValue placeholder="지역을 선택해 주세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(region => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 선호 장르 (단일 선택 칩) */}
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-(--neutral-700)">
                  <Music className="size-3.5 text-(--green-600)" />
                  선호 장르
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.map(genre => {
                    const selected = genreField.value === genre.value;
                    return (
                      <button
                        key={genre.value}
                        type="button"
                        onClick={() => genreField.onChange(genre.value)}
                        className={`rounded-full border px-4 py-2 text-sm leading-none transition-colors duration-150 ${
                          selected
                            ? 'border-(--green-800) bg-(--green-800) font-semibold text-white'
                            : 'border-(--neutral-200) bg-white text-(--neutral-600) hover:border-(--green-400) hover:bg-(--green-50) hover:text-(--green-700)'
                        }`}>
                        {genre.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 레슨 목표 */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="goal"
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-(--neutral-700)">
                  <Target className="size-3.5 text-(--green-600)" />
                  레슨 목표
                </label>
                <Textarea
                  id="goal"
                  rows={4}
                  placeholder="예: 음치 탈출, 가수 오디션 준비, 취미로 노래 즐기기..."
                  {...register('goal')}
                />
              </div>
            </div>

            {/* CTA */}
            <div className="mt-7">
              <Button
                type="submit"
                variant="emphasis"
                size="lg"
                disabled={!canSubmit}
                rightIcon={<ArrowRight className="size-4.5" />}
                className="w-full rounded-full">
                코치 매칭 받기
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

// 신청 완료 화면 — 프로덕션 SuccessView는 실제 현황 페이지로 링크가 고정돼 있어 데모용으로 따로 둔다
function DemoSuccessView({ values, onNext }: { values: LessonRequestFormType; onNext: () => void }) {
  const regionLabel = REGIONS.find(item => item.value === values.region)?.label ?? values.region;
  const genreLabel = GENRES.find(item => item.value === values.genre)?.label ?? values.genre;

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

      <Button type="button" variant="emphasis" size="lg" onClick={onNext} className="self-start rounded-full">
        현황 보러가기
      </Button>
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
