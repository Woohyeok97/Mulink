import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
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

// 제안 취소는 신청 하위가 아닌 제안 리소스(lesson-proposals/:id)라 별도 컨트롤러로 둔다
@Controller('lesson-proposals')
@UseGuards(SupabaseAuthGuard)
export class LessonProposalCancelController {
  constructor(private readonly lessonProposalService: LessonProposalService) {}

  // 레슨 제안 취소 (본인 제안만)
  @Delete(':id')
  async removeProposal(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.lessonProposalService.removeLessonProposal(req.user.id, id);
  }
}
