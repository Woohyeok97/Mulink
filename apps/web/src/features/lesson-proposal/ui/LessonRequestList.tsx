'use client';

import { useRef, useState } from 'react';
// components
import { MapPin, Music, Send, Check, X, Clock } from 'lucide-react';
import { Button } from '@/shared/ui/button/button';
import { Badge } from '@/shared/ui/badge/badge';
import { ProposalForm } from './ProposalForm';
import { ProposalDetail } from './ProposalDetail';
// types
import { REGION_LABEL, GENRE_LABEL } from '@/entities/lesson-request/lesson-request.type';
import type { OpenLessonRequest } from '@/entities/lesson-request/lesson-request.type';
// utils
import { toRelativeTime } from '@/shared/lib/relative-time';

// 아바타 이니셜 배경색: 닉네임 기반으로 팔레트에서 하나 고른다(항상 같은 색)
const AVATAR_COLORS = ['#3B6B4F', '#6B7E63', '#A8966F', '#5B7E8A', '#7E6B8A'];

function pickAvatarColor(name: string) {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export function LessonRequestList({ requests }: { requests: OpenLessonRequest[] }) {
  return (
    <div className="flex flex-col gap-2">
      {requests.map(request => (
        <LessonRequestRow key={request.id} request={request} />
      ))}
    </div>
  );
}

// 한 건의 신청 행. isExpanded 하나로 펼침만 관리하고, myProposal 유무로 폼/상세를 가른다.
function LessonRequestRow({ request }: { request: OpenLessonRequest }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isProposed = request.myProposal !== null;
  const rowRef = useRef<HTMLDivElement>(null);

  // 펼침 토글 핸들러 — 펼칠 때는 카드가 화면 중앙에 오도록 스크롤
  const toggleExpanded = () => {
    setIsExpanded(prev => {
      const next = !prev;
      if (next) requestAnimationFrame(() => rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return next;
    });
  };

  // 펼침 영역을 닫는다 (전송·취소 성공 후 부모가 호출)
  const closeExpanded = () => setIsExpanded(false);

  return (
    <div
      ref={rowRef}
      className={`overflow-hidden rounded-2xl border bg-white transition-colors ${
        isExpanded ? 'border-(--green-200)' : 'border-(--neutral-200)'
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
            className={`text-sm font-semibold ${isProposed ? 'text-(--neutral-400)' : 'text-(--neutral-900)'}`}>
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
          className={`min-w-0 line-clamp-3 rounded-[10px] bg-(--neutral-50) p-3 text-[13.5px] leading-relaxed [grid-area:goal] sm:flex-1 sm:truncate sm:line-clamp-none sm:bg-transparent sm:p-0 sm:text-[13px] sm:leading-normal ${isProposed ? 'text-(--neutral-400)' : 'text-(--neutral-600)'}`}>
          {request.goal}
        </p>
        <div className="shrink-0 [grid-area:action]">
          {isExpanded ? (
            <Button size="sm" variant="outline" onClick={toggleExpanded} leftIcon={<X size={13} />}>
              닫기
            </Button>
          ) : isProposed ? (
            // 제안 완료: 시안의 초록 pill 스타일
            <Button
              size="sm"
              variant="outline"
              onClick={toggleExpanded}
              className="rounded-full border-(--green-100) bg-(--green-50) text-(--green-700) hover:border-(--green-200) hover:bg-(--green-100) hover:text-(--green-700)"
              leftIcon={<Check size={13} />}>
              제안 완료
            </Button>
          ) : (
            <Button size="sm" onClick={toggleExpanded} leftIcon={<Send size={13} />}>
              제안
            </Button>
          )}
        </div>
      </div>

      {/* 펼침 영역: 제안 전이면 폼, 제안 후면 상세 */}
      {isExpanded ? (
        request.myProposal ? (
          <ProposalDetail proposal={request.myProposal} onCancelled={closeExpanded} />
        ) : (
          <ProposalForm
            requestId={request.id}
            studentNickname={request.studentNickname}
            onSent={closeExpanded}
            onCancel={closeExpanded}
          />
        )
      ) : null}
    </div>
  );
}
