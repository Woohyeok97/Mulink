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
import { LessonService } from './lesson.service';
import type { CreateLessonRequestDto } from './dto/create-lesson-request.dto';

type AuthedRequest = { user: SupabaseUser };

@Controller('lesson-requests')
@UseGuards(SupabaseAuthGuard)
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  // 학생 레슨 신청 POST 요청
  @Post()
  async createLessonRequest(
    @Req() req: AuthedRequest,
    @Body() dto: CreateLessonRequestDto,
  ) {
    return this.lessonService.createLessonRequest(req.user.id, dto);
  }

  @Delete(':id')
  async removeLessonRequest(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ) {
    return this.lessonService.removeLessonRequest(req.user.id, id);
  }
}
