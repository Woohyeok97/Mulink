import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LessonProposalService } from './lesson-proposal.service';
import type { CreateLessonProposalDto } from './dto/create-lesson-proposal.dto';

type AuthedRequest = { user: SupabaseUser };

@Controller('lesson-requests/:id/lesson-proposals')
@UseGuards(SupabaseAuthGuard)
export class LessonProposalController {
  constructor(private readonly lessonProposalService: LessonProposalService) {}

  // 레슨 제안 생성 POST 요청 (body로 coachId를 받지 않음 — 위조 방지)
  @Post()
  async createProposal(
    @Req() req: AuthedRequest,
    @Param('id') requestId: string,
    @Body() dto: CreateLessonProposalDto,
  ) {
    return this.lessonProposalService.createLessonProposal(
      req.user.id,
      requestId,
      dto,
    );
  }
}
