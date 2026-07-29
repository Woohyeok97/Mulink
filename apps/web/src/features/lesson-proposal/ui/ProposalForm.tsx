'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
// components
import { Target, Send } from 'lucide-react';
import { Button } from '@/shared/ui/button/button';
import { Textarea } from '@/shared/ui/textarea/textarea';
// schema
import { LessonProposalSchema, type LessonProposalFormType } from '../lesson-proposal.schema';
// mutations
import { useCreateLessonProposalMutation } from '../lesson-proposal.mutate';

interface ProposalFormProps {
  requestId: string;
  studentNickname: string;
  onSent: () => void;
  onCancel: () => void;
}

// 아직 제안하지 않은 신청에 한마디를 적어 보내는 인라인 폼
export function ProposalForm({ requestId, studentNickname, onSent, onCancel }: ProposalFormProps) {
  const router = useRouter();

  const { register, handleSubmit, formState } = useForm<LessonProposalFormType>({
    resolver: zodResolver(LessonProposalSchema),
    defaultValues: { message: '' }
  });

  // 폼 상태
  const { errors } = formState;

  // 레슨 제안 전송 mutate
  const { mutate, isPending } = useCreateLessonProposalMutation({
    onSuccess: result => {
      if (result?.error) {
        alert(result.error);
        return;
      }
      onSent();
      router.refresh(); // 서버 목록 재검증 → myProposal 갱신
    }
  });

  // 제안 전송 핸들러
  const handleSendProposal = handleSubmit(({ message }) => mutate({ requestId, message }));

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
        autoFocus
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
        <Button type="submit" size="sm" loading={isPending} leftIcon={<Send size={13} />}>
          제안 전송
        </Button>
      </div>
    </form>
  );
}
