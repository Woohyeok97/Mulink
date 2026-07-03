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
import { LessonRequestService } from './lesson-request.service';
import type { CreateLessonRequestDto } from './dto/create-lesson-request.dto';

type AuthedRequest = { user: SupabaseUser };

@Controller('lesson-requests')
@UseGuards(SupabaseAuthGuard)
export class LessonRequestController {
  constructor(private readonly lessonRequestService: LessonRequestService) {}

  // 레슨 신청 조회 GET 요청
  @Get('me')
  async getMyLessonRequest(@Req() req: AuthedRequest) {
    return await this.lessonRequestService.getMyLessonRequest(req.user.id);
  }

  // 레슨 신청 POST 요청
  @Post()
  async createLessonRequest(
    @Req() req: AuthedRequest,
    @Body() dto: CreateLessonRequestDto,
  ) {
    return this.lessonRequestService.createLessonRequest(req.user.id, dto);
  }

  // 레슨 신청 삭제 DELETE 요청
  @Delete(':id')
  async removeLessonRequest(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ) {
    return this.lessonRequestService.removeLessonRequest(req.user.id, id);
  }

  // 모집중 레슨 신청 목록 조회 GET 요청 (코치)
  @Get()
  async getOpenLessonRequests(@Req() req: AuthedRequest) {
    return this.lessonRequestService.getOpenLessonRequests(req.user.id);
  }
}
