import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { CoachProfileService } from './coach-profile.service';
import { S3Service } from '../s3/s3.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { RegisterCoachDto } from './dto/register-coach.dto';
import type { UploadUrlDto } from './dto/upload-url.dto';

type AuthedRequest = { user: SupabaseUser };

@Controller('coach-profiles')
@UseGuards(SupabaseAuthGuard)
export class CoachProfileController {
  constructor(
    private readonly coachProfileService: CoachProfileService,
    private readonly s3Service: S3Service,
  ) {}

  // 프로필 이미지 업로드용 S3 presigned URL 발급 (브라우저가 이 URL로 S3에 직접 PUT)
  @Post('upload-url')
  async createUploadUrl(@Body() dto: UploadUrlDto) {
    // 이미지 파일만 허용
    if (!dto.contentType?.startsWith('image/')) {
      throw new BadRequestException('이미지 파일만 업로드할 수 있습니다.');
    }
    return this.s3Service.createUploadUrl(dto.contentType);
  }

  // 코치 신청 POST 요청 (body로 userId를 받지 않음 — 위조 방지)
  @Post()
  async registerCoach(
    @Req() req: AuthedRequest,
    @Body() dto: RegisterCoachDto,
  ) {
    return this.coachProfileService.registerCoach(req.user.id, dto);
  }
}
