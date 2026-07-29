'use client';

import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// components
import { SidePanel } from './SidePanel';
import { SuccessView } from './SuccessView';
import { MapPin, Music, Target, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button/button';
import { Textarea } from '@/shared/ui/textarea/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select/select';
// schemas
import { LessonRequestSchema, REGIONS, GENRES, type LessonRequestFormType } from '../../lesson-request.schema';
// mutations
import { useCreateLessonRequestMutation } from '../../lesson-request.mutate';

export function LessonRequestForm() {
  const { register, control, handleSubmit, formState } = useForm<LessonRequestFormType>({
    resolver: zodResolver(LessonRequestSchema),
    defaultValues: {
      region: undefined,
      genre: undefined,
      goal: ''
    }
  });

  // 폼 상태
  const { isValid } = formState;

  // 지역 선택 controller
  const { field: regionField } = useController({ name: 'region', control });

  // 선호 장르 controller
  const { field: genreField } = useController({ name: 'genre', control });

  // 레슨 신청 mutate
  const { mutate, isPending, isSuccess, data: mutationResult, variables: submitted } = useCreateLessonRequestMutation();

  // 레슨 신청 핸들러
  const onSubmit = handleSubmit(data => mutate(data));

  // 레슨 신청 버튼 활성화 상태
  const canSubmit = [isValid].every(Boolean);

  return (
    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      <SidePanel control={control} />

      <main className="flex flex-1 flex-col justify-start overflow-y-auto bg-white px-5 py-7 sm:justify-center sm:px-10 sm:py-11 lg:px-22 lg:py-16">
        {isSuccess && !mutationResult?.error ? (
          <div className="mx-auto flex w-full max-w-130 flex-1 flex-col justify-center">
            <SuccessView region={submitted.region} genre={submitted.genre} />
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="mx-auto flex w-full max-w-130 flex-col">
            {mutationResult?.error ? (
              <div role="alert" className="mb-5 rounded-md bg-(--danger-100) px-4 py-3 text-sm text-destructive">
                {mutationResult.error}
              </div>
            ) : null}

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
                loading={isPending}
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
