'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// components
import { MapPin, Music, Send, Check, X, Clock, Target, Sparkles } from 'lucide-react';
import { Button } from '@/shared/ui/button/button';
import { Badge } from '@/shared/ui/badge/badge';
import { Textarea } from '@/shared/ui/textarea/textarea';
import { DemoProposalSentDialog } from './DemoProposalSentDialog';
// types
import { REGION_LABEL, GENRE_LABEL } from '@/entities/lesson-request/lesson-request.type';
import type { MyProposal, OpenLessonRequest } from '@/entities/lesson-request/lesson-request.type';
// schema
import { LessonProposalSchema, type LessonProposalFormType } from '@/features/lesson-proposal/lesson-proposal.schema';
// utils
import { toRelativeTime } from '@/shared/lib/relative-time';
import { toAbsoluteTime } from '@/shared/lib/absolute-time';

// 아바타 이니셜 배경색: 닉네임 기반으로 팔레트에서 하나 고른다(항상 같은 색)
const AVATAR_COLORS = ['#3B6B4F', '#6B7E63', '#A8966F', '#5B7E8A', '#7E6B8A'];

function pickAvatarColor(name: string) {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

// 프로덕션 LessonRequestList의 데모판.
// 제안은 서버로 보내지 않고 이 컴포넌트의 state에만 쌓는다.
export function DemoLessonRequestList({ requests }: { requests: OpenLessonRequest[] }) {
  // 신청 id → 내가 보낸 제안. 전송/취소가 이 map만 갱신한다.
  const [proposals, setProposals] = useState<Record<string, MyProposal>>({});
  const [sentDialogOpen, setSentDialogOpen] = useState(false);

  // 제안 전송 — 화면에만 남기고 안내 모달을 띄운다
  const handleSend = (requestId: string, message: string) => {
    setProposals(prev => ({
      ...prev,
      [requestId]: { id: `demo-proposal-${requestId}`, message, createdAt: new Date().toISOString() }
    }));
    setSentDialogOpen(true);
  };

  // 제안 취소 — 다시 제안 가능 상태로 되돌린다
  const handleCancel = (requestId: string) => {
    setProposals(prev => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        {requests.map(request => (
          <LessonRequestRow
            key={request.id}
            request={request}
            myProposal={proposals[request.id] ?? null}
            onSend={handleSend}
            onCancel={handleCancel}
          />
        ))}
      </div>

      <DemoProposalSentDialog open={sentDialogOpen} onClose={() => setSentDialogOpen(false)} />
    </>
  );
}

interface LessonRequestRowProps {
  request: OpenLessonRequest;
  myProposal: MyProposal | null;
  onSend: (requestId: string, message: string) => void;
  onCancel: (requestId: string) => void;
}

// 한 건의 신청 행. isExpanded 하나로 펼침만 관리하고, myProposal 유무로 폼/상세를 가른다.
function LessonRequestRow({ request, myProposal, onSend, onCancel }: LessonRequestRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isProposed = myProposal !== null;
  const rowRef = useRef<HTMLDivElement>(null);

  // 펼침 토글 핸들러 — 펼칠 때는 카드가 화면 중앙에 오도록 스크롤
  const toggleExpanded = () => {
    setIsExpanded(prev => {
      const next = !prev;
      if (next) requestAnimationFrame(() => rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return next;
    });
  };

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
          <div className={`text-sm font-semibold ${isProposed ? 'text-(--neutral-400)' : 'text-(--neutral-900)'}`}>
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
        myProposal ? (
          <ProposalDetail
            proposal={myProposal}
            onCancel={() => {
              onCancel(request.id);
              setIsExpanded(false);
            }}
          />
        ) : (
          <ProposalForm
            studentNickname={request.studentNickname}
            onSend={message => {
              onSend(request.id, message);
              setIsExpanded(false);
            }}
            onCancel={() => setIsExpanded(false)}
          />
        )
      ) : null}
    </div>
  );
}

interface ProposalFormProps {
  studentNickname: string;
  onSend: (message: string) => void;
  onCancel: () => void;
}

// 아직 제안하지 않은 신청에 한마디를 적어 보내는 인라인 폼
function ProposalForm({ studentNickname, onSend, onCancel }: ProposalFormProps) {
  const { register, handleSubmit, formState } = useForm<LessonProposalFormType>({
    resolver: zodResolver(LessonProposalSchema),
    // 체험자가 바로 보내볼 수 있도록 미리 채워둔다(수정 가능)
    defaultValues: { message: `${studentNickname}님, 목표에 딱 맞는 커리큘럼으로 도와드릴게요. 편하게 상담 주세요!` }
  });

  // 폼 상태
  const { errors } = formState;

  // 제안 전송 핸들러
  const handleSendProposal = handleSubmit(({ message }) => onSend(message));

  return (
    <form
      onSubmit={handleSendProposal}
      noValidate
      className="animate-in fade-in-0 slide-in-from-top-2 duration-200 border-t border-(--neutral-100) bg-(--green-50) px-5 py-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-(--green-700)">
        <Target size={13} />
        {studentNickname}님께 한마디
      </div>
      <Textarea
        rows={3}
        className="bg-white"
        placeholder="학생에게 전할 한마디를 적어 주세요."
        aria-invalid={errors.message ? 'true' : undefined}
        {...register('message')}
      />
      {errors.message ? (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {errors.message.message}
        </p>
      ) : null}
      <div className="mt-2.5 flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" size="sm" leftIcon={<Send size={13} />}>
          제안 전송
        </Button>
      </div>
    </form>
  );
}

// 이미 보낸 제안의 한마디·발송 시각을 보여주고, 취소할 수 있는 상세 영역
function ProposalDetail({ proposal, onCancel }: { proposal: MyProposal; onCancel: () => void }) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-top-2 duration-200 border-t border-(--neutral-100) bg-(--green-50) px-5 py-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-(--green-700)">
        <Sparkles size={13} />
        내가 보낸 레슨 제안
      </div>
      <div className="rounded-xl border border-(--neutral-200) bg-white px-4 py-3.5 text-sm leading-relaxed text-(--neutral-800)">
        {proposal.message}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-(--neutral-400)">{toAbsoluteTime(proposal.createdAt)} 전송</span>
        <Button size="sm" variant="destructive" onClick={onCancel} leftIcon={<X size={13} />}>
          레슨 제안 취소
        </Button>
      </div>
    </div>
  );
}
