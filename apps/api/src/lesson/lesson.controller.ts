import {
  Body,
  Controller,
  Delete,
  Get,
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

  // 레슨 신청 조회 GET 요청
  @Get('me')
  async getMyLessonRequest(@Req() req: AuthedRequest) {
    return await this.lessonService.getMyLessonRequest(req.user.id);
  }

  // 내 레슨 신청에 달린 코치 오퍼 목록 GET 요청
  @Get('me/offers')
  getMyLessonOffers() {
    return this.lessonService.getMyLessonOffers();
  }

  // 레슨 신청 POST 요청
  @Post()
  async createLessonRequest(
    @Req() req: AuthedRequest,
    @Body() dto: CreateLessonRequestDto,
  ) {
    return this.lessonService.createLessonRequest(req.user.id, dto);
  }

  // 레슨 신청 삭제 DELETE 요청
  @Delete(':id')
  async removeLessonRequest(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ) {
    return this.lessonService.removeLessonRequest(req.user.id, id);
  }
}
