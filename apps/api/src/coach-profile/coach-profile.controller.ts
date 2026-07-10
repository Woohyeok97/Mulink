import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { CoachProfileService } from './coach-profile.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { RegisterCoachDto } from './dto/register-coach.dto';

type AuthedRequest = { user: SupabaseUser };

@Controller('coach-profiles')
@UseGuards(SupabaseAuthGuard)
export class CoachProfileController {
  constructor(private readonly coachProfileService: CoachProfileService) {}

  // 코치 신청 POST 요청 (body로 userId를 받지 않음 — 위조 방지)
  @Post()
  async registerCoach(
    @Req() req: AuthedRequest,
    @Body() dto: RegisterCoachDto,
  ) {
    return this.coachProfileService.registerCoach(req.user.id, dto);
  }
}
