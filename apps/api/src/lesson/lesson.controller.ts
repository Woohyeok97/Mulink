import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LessonService } from './lesson.service';
import type { CreateLessonRequestDto } from './dto/create-lesson-request.dto';

type AuthedRequest = { user: SupabaseUser };

@Controller('lesson-requests')
@UseGuards(SupabaseAuthGuard)
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Post()
  async createLessonRequest(
    @Req() req: AuthedRequest,
    @Body() dto: CreateLessonRequestDto,
  ) {
    return this.lessonService.createLessonRequest(req.user.id, dto);
  }
}
