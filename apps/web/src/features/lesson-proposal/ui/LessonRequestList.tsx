'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
// components
import { MapPin, Music, Target, Send, Check, X, Clock, FileText } from 'lucide-react';
import { Button } from '@/shared/ui/button/button';
import { Badge } from '@/shared/ui/badge/badge';
import { Textarea } from '@/shared/ui/textarea/textarea';
// schema
import { REGION_LABEL, GENRE_LABEL } from '@/entities/lesson-request/lesson-request.type';
import type { OpenLessonRequest } from '@/entities/lesson-request/lesson-request.type';
import { LessonProposalSchema, type LessonProposalFormType } from '../lesson-proposal.schema';
// actions
import { createLessonProposalAction } from '../lesson-proposal.action';
// utils
import { toRelativeTime } from '@/shared/lib/relative-time';

// 아바타 이니셜 배경색: 닉네임 기반으로 팔레트에서 하나 고른다(항상 같은 색)
const AVATAR_COLORS = ['#3B6B4F', '#6B7E63', '#A8966F', '#5B7E8A', '#7E6B8A'];

function pickAvatarColor(name: string) {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export function LessonRequestList({ requests }: { requests: OpenLessonRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-(--neutral-200) bg-white px-6 py-20 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-(--green-50) text-(--green-300)">
          <FileText size={38} />
        </div>
        <div>
          <p className="mb-2 text-[17px] font-bold text-(--neutral-800)">아직 모집 중인 레슨 신청이 없어요</p>
          <p className="text-sm leading-relaxed break-keep text-(--neutral-500)">
            학생들이 새 레슨 신청을 올리면 여기에 나타나요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {requests.map(request => (
        <LessonRequestRow key={request.id} request={request} />
      ))}
    </div>
  );
}

// 한 건의 신청 행 + 인라인 제안 폼. 각 행이 독립된 폼 상태를 가진다.
function LessonRequestRow({ request }: { request: OpenLessonRequest }) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { register, handleSubmit, reset, formState } = useForm<LessonProposalFormType>({
    resolver: zodResolver(LessonProposalSchema),
    defaultValues: { message: '' }
  });

  // 폼 상태
  const { errors, isSubmitting } = formState;

  // 제안 폼을 닫고 입력·검증 상태를 비운다 (다시 열 때 잔상이 남지 않도록)
  const closeProposalForm = () => {
    setIsFormOpen(false);
    reset();
  };

  // 제안 폼 열기/닫기 토글
  const toggleProposalForm = () => {
    if (isFormOpen) {
      closeProposalForm();
      return;
    }
    setIsFormOpen(true);
    reset();
  };

  // 제안 전송 핸들러
  const handleSendProposal = handleSubmit(async ({ message }) => {
    const result = await createLessonProposalAction(request.id, message);
    if (result?.error) {
      alert(result.error);
      return;
    }
    closeProposalForm();
    router.refresh(); // 서버 목록 재검증 → isProposed 갱신
  });

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white transition-colors ${
        isFormOpen ? 'border-(--green-200)' : 'border-(--neutral-200)'
      }`}>
      {/* 스트립 행: 640px 미만에서는 아바타·이름·액션 / 배지 / 목표를 3행 grid로 재배치 */}
      <div className="grid grid-cols-[44px_1fr_auto] items-center gap-x-3.5 gap-y-3.5 px-4.5 py-4.5 [grid-template-areas:'avatar_name_action'_'badges_badges_badges'_'goal_goal_goal'] sm:flex sm:grid-cols-none sm:gap-3.5 sm:px-5 sm:py-3.5 sm:[grid-template-areas:none]">
        <div
          className="flex size-9.5 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white [grid-area:avatar]"
          style={{ backgroundColor: pickAvatarColor(request.studentNickname) }}>
          {request.studentNickname[0]}
        </div>
        <div className="shrink-0 [grid-area:name] sm:w-24">
          <div
            className={`text-sm font-semibold ${request.isProposed ? 'text-(--neutral-400)' : 'text-(--neutral-900)'}`}>
            {request.studentNickname}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-(--neutral-400)">
            <Clock size={10} />
            {toRelativeTime(request.createdAt)}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 [grid-area:badges] sm:gap-1.5">
          <Badge variant="brand">
            <MapPin size={11} />
            {REGION_LABEL[request.region]}
          </Badge>
          <Badge variant="neutral">
            <Music size={11} />
            {GENRE_LABEL[request.genre]}
          </Badge>
        </div>
        <p
          className={`min-w-0 line-clamp-3 rounded-[10px] bg-(--neutral-50) p-3 text-[13.5px] leading-relaxed [grid-area:goal] sm:flex-1 sm:truncate sm:line-clamp-none sm:bg-transparent sm:p-0 sm:text-[13px] sm:leading-normal ${request.isProposed ? 'text-(--neutral-400)' : 'text-(--neutral-600)'}`}>
          {request.goal}
        </p>
        <div className="shrink-0 [grid-area:action]">
          {request.isProposed ? (
            <Badge variant="success">
              <Check size={11} />
              제안 완료
            </Badge>
          ) : (
            <Button
              size="sm"
              variant={isFormOpen ? 'outline' : 'default'}
              onClick={toggleProposalForm}
              leftIcon={
                <div className="flex items-center gap-2">
                  {isFormOpen ? (
                    <>
                      <X size={13} />
                      닫기
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      제안
                    </>
                  )}
                </div>
              }></Button>
          )}
        </div>
      </div>

      {/* 인라인 제안 폼 */}
      {isFormOpen && (
        <form
          onSubmit={handleSendProposal}
          noValidate
          className="animate-in fade-in-0 slide-in-from-top-2 duration-200 border-t border-(--neutral-100) bg-(--green-50) px-5 py-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-(--green-700)">
            <Target size={13} />
            {request.studentNickname}님께 한마디
          </div>
          <Textarea
            autoFocus
            rows={3}
            className="bg-white"
            placeholder="학생에게 전할 한마디를 적어 주세요."
            aria-invalid={errors.message ? 'true' : undefined}
            {...register('message')}
          />
          {errors.message && (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              {errors.message.message}
            </p>
          )}
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={closeProposalForm}>
              취소
            </Button>
            <Button type="submit" size="sm" loading={isSubmitting} leftIcon={<Send size={13} />}>
              제안 전송
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
