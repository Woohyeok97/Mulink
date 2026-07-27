import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { createLessonProposalAction, deleteLessonProposalAction } from './lesson-proposal.action';

type LessonProposalActionResult = { error: string } | void;

type CreateLessonProposalVariables = { requestId: string; message: string };

type CreateLessonProposalMutationOptions = UseMutationOptions<
  LessonProposalActionResult,
  Error,
  CreateLessonProposalVariables
>;

// 레슨 제안 전송 뮤테이션
export function useCreateLessonProposalMutation(options?: CreateLessonProposalMutationOptions) {
  return useMutation({
    mutationFn: ({ requestId, message }: CreateLessonProposalVariables) =>
      createLessonProposalAction(requestId, message),
    ...options,
  });
}

type DeleteLessonProposalMutationOptions = UseMutationOptions<LessonProposalActionResult, Error, string>;

// 레슨 제안 취소 뮤테이션
export function useDeleteLessonProposalMutation(options?: DeleteLessonProposalMutationOptions) {
  return useMutation({
    mutationFn: deleteLessonProposalAction,
    ...options,
  });
}
