'use client';

import { useWatch, type Control } from 'react-hook-form';
import { Mic, Check } from 'lucide-react';
import { WaveVisualizer } from '@/shared/ui/wave-visualizer/wave-visualizer';
import type { LessonRequestFormType } from '../../lesson-request.schema';

const STEPS = ['지역 선택', '선호 장르', '레슨 목표'];

interface SidePanelProps {
  control: Control<LessonRequestFormType>;
}

export function SidePanel({ control }: SidePanelProps) {
  const [region, genre, goal] = useWatch({
    control,
    name: ['region', 'genre', 'goal'] as const
  });

  // 완료 필드 여부
  const stepDone = [Boolean(region), Boolean(genre), Boolean(goal?.trim())];

  return (
    <aside className="flex shrink-0 flex-col justify-between bg-(--green-800) px-6 py-5 sm:h-screen sm:w-65 sm:px-7 sm:py-11 lg:sticky lg:top-0 lg:w-105 lg:px-13 lg:py-15">
      {/* 로고 */}
      <div className="flex items-center gap-2">
        <Mic className="size-5.5 text-white" strokeWidth={2} />
        <span className="text-base font-extrabold tracking-tight text-white">MU:LINK</span>
        <span className="ml-2 text-xs font-normal text-white/50 sm:hidden">· 보컬 코치 매칭</span>
      </div>

      {/* 중앙 카피 — 모바일 숨김 */}
      <div className="hidden sm:block">
        <WaveVisualizer className="mb-7 h-11" />
        <h2 className="mb-3.5 text-[26px] font-extrabold leading-tight tracking-tighter break-keep text-white">
          나에게 맞는
          <br />
          보컬 코치 찾기
        </h2>
        <p className="text-sm leading-relaxed break-keep text-white/60">
          몇 가지 정보만 입력하면
          <br />
          최적의 코치를 매칭해 드려요.
        </p>
      </div>

      {/* 스텝 리스트 — 모바일 숨김 */}
      <div className="hidden flex-col gap-3 sm:flex">
        {STEPS.map((step, index) => {
          const done = stepDone[index];
          return (
            <div key={step} className="flex items-center gap-2.5">
              <div
                className={`flex size-5.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                  done ? 'border-(--green-300) bg-(--green-300)/20' : 'border-white/20 bg-white/10'
                }`}>
                {done ? (
                  <Check className="size-3 text-(--green-300)" strokeWidth={3} />
                ) : (
                  <span className="font-mono text-[10px] font-bold text-white/55">{index + 1}</span>
                )}
              </div>
              <span className={`text-sm transition-colors duration-200 ${done ? 'text-white' : 'text-white/55'}`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
