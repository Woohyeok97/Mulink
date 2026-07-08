import { z } from 'zod';

// 제안 한마디 폼 스키마 (공백만이면 거부 — 백엔드 검증과 동일)
export const LessonProposalSchema = z.object({
  message: z.string().trim().min(1, '제안 한마디를 입력해 주세요.'),
});

// 제안 폼 타입
export type LessonProposalFormType = z.infer<typeof LessonProposalSchema>;
