import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { CoachService } from './coach.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { RegisterCoachDto } from './dto/register-coach.dto';

type AuthedRequest = { user: SupabaseUser };

@Controller('coaches')
@UseGuards(SupabaseAuthGuard)
export class CoachController {
  constructor(private readonly coachService: CoachService) {}

  // 코치 신청 POST 요청 (body로 userId를 받지 않음 — 위조 방지)
  @Post()
  async registerCoach(
    @Req() req: AuthedRequest,
    @Body() dto: RegisterCoachDto,
  ) {
    return this.coachService.registerCoach(req.user.id, dto);
  }
}
