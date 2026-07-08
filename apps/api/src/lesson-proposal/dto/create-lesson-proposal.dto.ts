// POST /lesson-requests/:id/lesson-proposals 요청 body. 제안 한마디만 받는다.
export interface CreateLessonProposalDto {
  message: string;
}
