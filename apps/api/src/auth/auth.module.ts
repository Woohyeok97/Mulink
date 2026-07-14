import { Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { KakaoAuthController } from './kakao-auth.controller';
import { SessionController } from './session.controller';
import { DevLoginController } from './dev-login.controller'; // ⚠️ 개발 전용 (제거 대상)
import { ReproSessionController } from './repro-session.controller'; // ⚠️ 재현 전용 (제거 대상)
import { KakaoOauthService } from './kakao-oauth.service';
import { SupabaseAdminService } from './supabase-admin.service';
import { SessionCodeService } from './session-code.service';
import { RedisProvider } from './redis.provider';

// auth 관련된 모든 것을 하나로 묶는 Module (인증 "과정"만 담당)
@Module({
  controllers: [
    KakaoAuthController,
    SessionController,
    DevLoginController,
    ReproSessionController,
  ],
  providers: [
    SupabaseService,
    SupabaseAuthGuard,
    KakaoOauthService,
    SupabaseAdminService,
    SessionCodeService,
    RedisProvider,
  ],
  exports: [SupabaseAuthGuard, SupabaseService],
})
export class AuthModule {}
