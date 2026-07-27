import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { createLessonRequestAction, deleteLessonRequestAction } from './lesson-request.action';
import type { LessonRequestFormType } from './lesson-request.schema';

type LessonRequestActionResult = { error: string } | void;

type CreateLessonRequestMutationOptions = UseMutationOptions<
  LessonRequestActionResult,
  Error,
  LessonRequestFormType
>;

type DeleteLessonRequestMutationOptions = UseMutationOptions<
  LessonRequestActionResult,
  Error,
  string
>;

// 레슨 신청 생성 뮤테이션
export function useCreateLessonRequestMutation(options?: CreateLessonRequestMutationOptions) {
  return useMutation({
    mutationFn: createLessonRequestAction,
    ...options,
  });
}

// 레슨 신청 삭제 뮤테이션
export function useDeleteLessonRequestMutation(options?: DeleteLessonRequestMutationOptions) {
  return useMutation({
    mutationFn: deleteLessonRequestAction,
    ...options,
  });
}
